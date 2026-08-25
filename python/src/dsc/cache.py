from __future__ import annotations

import json
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from dsc.config import Settings, get_settings
from dsc.domain.enter import enter_domain
from dsc.domain.fetch import fetch_domain_data, fetch_domain_metadata

NAVMESH = ("navmesh_v1", "obj")
OCCLUSION = ("occlusionmesh_v1", "obj")


@dataclass
class CachedAsset:
    domain_id: str
    name: str
    data_type: str
    data: str
    metadata: dict[str, Any]
    last_checked: float


class DomainCache:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self._memory: dict[tuple[str, str, str], CachedAsset] = {}
        self._lock = threading.RLock()
        self._watcher: threading.Thread | None = None
        self._stop = threading.Event()

    def _key(self, domain_id: str, name: str, data_type: str) -> tuple[str, str, str]:
        return (domain_id, name, data_type)

    def _asset_dir(self, domain_id: str) -> Path:
        path = self.settings.cache_dir / domain_id
        path.mkdir(parents=True, exist_ok=True)
        return path

    def _paths(self, domain_id: str, name: str, data_type: str) -> tuple[Path, Path]:
        folder = self._asset_dir(domain_id)
        data_path = folder / f"{name}.{data_type}"
        meta_path = folder / f"{name}.{data_type}.meta.json"
        return data_path, meta_path

    def _read_disk(self, domain_id: str, name: str, data_type: str) -> CachedAsset | None:
        data_path, meta_path = self._paths(domain_id, name, data_type)
        if not data_path.exists() or not meta_path.exists():
            return None
        sidecar = json.loads(meta_path.read_text())
        return CachedAsset(
            domain_id=domain_id,
            name=name,
            data_type=data_type,
            data=data_path.read_text(),
            metadata=sidecar.get("metadata") or {},
            last_checked=float(sidecar.get("last_checked") or 0),
        )

    def _write_disk(self, asset: CachedAsset) -> None:
        data_path, meta_path = self._paths(asset.domain_id, asset.name, asset.data_type)
        data_path.write_text(asset.data)
        meta_path.write_text(
            json.dumps(
                {
                    "metadata": asset.metadata,
                    "last_checked": asset.last_checked,
                }
            )
        )

    def _download(
        self, domain_id: str, name: str, data_type: str
    ) -> CachedAsset:
        authorization, domain_server_url = enter_domain(domain_id, self.settings)
        metadata, data = fetch_domain_data(
            domain_server_url, domain_id, authorization, name, data_type
        )
        asset = CachedAsset(
            domain_id=domain_id,
            name=name,
            data_type=data_type,
            data=data,
            metadata=metadata,
            last_checked=time.time(),
        )
        return asset

    def _metadata_changed(
        self, cached: CachedAsset, remote: dict[str, Any]
    ) -> bool:
        return remote.get("id") != cached.metadata.get("id") or remote.get(
            "updated_at"
        ) != cached.metadata.get("updated_at")

    def _revalidate(self, cached: CachedAsset) -> CachedAsset:
        authorization, domain_server_url = enter_domain(
            cached.domain_id, self.settings
        )
        remote = fetch_domain_metadata(
            domain_server_url,
            cached.domain_id,
            authorization,
            cached.name,
            cached.data_type,
        )
        if not self._metadata_changed(cached, remote):
            cached.last_checked = time.time()
            self._write_disk(cached)
            return cached
        metadata, data = fetch_domain_data(
            domain_server_url,
            cached.domain_id,
            authorization,
            cached.name,
            cached.data_type,
            metadata=remote,
        )
        updated = CachedAsset(
            domain_id=cached.domain_id,
            name=cached.name,
            data_type=cached.data_type,
            data=data,
            metadata=metadata,
            last_checked=time.time(),
        )
        return updated

    def get_asset(
        self,
        domain_id: str,
        name: str,
        data_type: str,
        refresh: bool = False,
    ) -> str:
        key = self._key(domain_id, name, data_type)
        interval = self.settings.dsc_cache_revalidate_seconds
        now = time.time()
        with self._lock:
            cached = self._memory.get(key) or self._read_disk(domain_id, name, data_type)
            if refresh or cached is None:
                asset = self._download(domain_id, name, data_type)
                self._memory[key] = asset
                self._write_disk(asset)
                return asset.data
            if now - cached.last_checked >= interval:
                asset = self._revalidate(cached)
                self._memory[key] = asset
                self._write_disk(asset)
                return asset.data
            self._memory[key] = cached
            return cached.data

    def known_keys(self) -> list[tuple[str, str, str]]:
        with self._lock:
            keys = set(self._memory.keys())
            cache_root = self.settings.cache_dir
            if cache_root.exists():
                for domain_dir in cache_root.iterdir():
                    if not domain_dir.is_dir():
                        continue
                    for meta in domain_dir.glob("*.meta.json"):
                        stem = meta.name[: -len(".meta.json")]
                        if "." not in stem:
                            continue
                        name, data_type = stem.rsplit(".", 1)
                        keys.add((domain_dir.name, name, data_type))
            return list(keys)

    def clear(self, domain_id: str | None = None) -> None:
        with self._lock:
            if domain_id is None:
                self._memory.clear()
                cache_root = self.settings.cache_dir
                if cache_root.exists():
                    for child in cache_root.iterdir():
                        if child.is_dir():
                            for file in child.iterdir():
                                file.unlink()
                            child.rmdir()
                return
            to_delete = [key for key in self._memory if key[0] == domain_id]
            for key in to_delete:
                del self._memory[key]
            domain_dir = self.settings.cache_dir / domain_id
            if domain_dir.exists():
                for file in domain_dir.iterdir():
                    file.unlink()
                domain_dir.rmdir()

    def start_watcher(self) -> None:
        with self._lock:
            if self._watcher and self._watcher.is_alive():
                return
            self._stop.clear()
            self._watcher = threading.Thread(
                target=self._watch_loop, name="dsc-domain-watcher", daemon=True
            )
            self._watcher.start()

    def stop_watcher(self) -> None:
        self._stop.set()
        watcher = self._watcher
        if watcher is not None:
            watcher.join(timeout=2)
        self._watcher = None

    def _watch_loop(self) -> None:
        interval = max(1, self.settings.dsc_cache_revalidate_seconds)
        while not self._stop.wait(interval):
            for domain_id, name, data_type in self.known_keys():
                if self._stop.is_set():
                    return
                try:
                    key = self._key(domain_id, name, data_type)
                    with self._lock:
                        cached = self._memory.get(key) or self._read_disk(
                            domain_id, name, data_type
                        )
                        if cached is not None:
                            cached.last_checked = 0
                            self._memory[key] = cached
                    self.get_asset(domain_id, name, data_type, refresh=False)
                except Exception as error:
                    print(f"domain watcher failed for {domain_id}/{name}: {error}")


_cache: DomainCache | None = None
_cache_lock = threading.Lock()


def get_cache() -> DomainCache:
    global _cache
    with _cache_lock:
        if _cache is None:
            _cache = DomainCache()
        return _cache


def reset_cache_instance() -> None:
    global _cache
    with _cache_lock:
        if _cache is not None:
            _cache.stop_watcher()
        _cache = None


def get_domain_asset(
    domain_id: str, name: str, data_type: str, refresh: bool = False
) -> str:
    return get_cache().get_asset(domain_id, name, data_type, refresh=refresh)


def clear_cache(domain_id: str | None = None) -> None:
    get_cache().clear(domain_id)


def start_domain_watcher() -> None:
    get_cache().start_watcher()


def stop_domain_watcher() -> None:
    get_cache().stop_watcher()
