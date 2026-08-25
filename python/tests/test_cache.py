import time

from dsc.cache import DomainCache
from dsc.config import Settings


def test_cache_hit_and_refresh(tmp_path, monkeypatch):
    downloads = {"count": 0}
    metadata_calls = {"count": 0}

    def fake_enter(domain_id, settings=None):
        return "Bearer token", "http://domain"

    def fake_fetch(server, domain_id, auth, name, data_type, metadata=None):
        downloads["count"] += 1
        meta = metadata or {
            "id": "1",
            "updated_at": "t1",
            "name": name,
            "data_type": data_type,
        }
        return meta, f"obj-{downloads['count']}"

    def fake_metadata(server, domain_id, auth, name, data_type):
        metadata_calls["count"] += 1
        return {"id": "1", "updated_at": "t1", "name": name, "data_type": data_type}

    monkeypatch.setattr("dsc.cache.enter_domain", fake_enter)
    monkeypatch.setattr("dsc.cache.fetch_domain_data", fake_fetch)
    monkeypatch.setattr("dsc.cache.fetch_domain_metadata", fake_metadata)

    settings = Settings(
        dsc_cache_dir=str(tmp_path),
        dsc_cache_revalidate_seconds=300,
    )
    cache = DomainCache(settings)
    first = cache.get_asset("dom", "navmesh_v1", "obj")
    second = cache.get_asset("dom", "navmesh_v1", "obj")
    assert first == second == "obj-1"
    assert downloads["count"] == 1
    assert metadata_calls["count"] == 0

    refreshed = cache.get_asset("dom", "navmesh_v1", "obj", refresh=True)
    assert refreshed == "obj-2"
    assert downloads["count"] == 2


def test_cache_revalidates_after_interval(tmp_path, monkeypatch):
    downloads = {"count": 0}

    def fake_enter(domain_id, settings=None):
        return "Bearer token", "http://domain"

    def fake_fetch(server, domain_id, auth, name, data_type, metadata=None):
        downloads["count"] += 1
        meta = metadata or {
            "id": str(downloads["count"]),
            "updated_at": f"t{downloads['count']}",
            "name": name,
            "data_type": data_type,
        }
        return meta, f"obj-{downloads['count']}"

    def fake_metadata(server, domain_id, auth, name, data_type):
        return {
            "id": "2",
            "updated_at": "t2",
            "name": name,
            "data_type": data_type,
        }

    monkeypatch.setattr("dsc.cache.enter_domain", fake_enter)
    monkeypatch.setattr("dsc.cache.fetch_domain_data", fake_fetch)
    monkeypatch.setattr("dsc.cache.fetch_domain_metadata", fake_metadata)

    settings = Settings(
        dsc_cache_dir=str(tmp_path),
        dsc_cache_revalidate_seconds=300,
    )
    cache = DomainCache(settings)
    cache.get_asset("dom", "navmesh_v1", "obj")
    key = cache._key("dom", "navmesh_v1", "obj")
    cache._memory[key].last_checked = time.time() - 301
    updated = cache.get_asset("dom", "navmesh_v1", "obj")
    assert updated == "obj-2"
    assert downloads["count"] == 2


def test_clear_cache(tmp_path, monkeypatch):
    monkeypatch.setattr(
        "dsc.cache.enter_domain", lambda *a, **k: ("Bearer token", "http://domain")
    )
    monkeypatch.setattr(
        "dsc.cache.fetch_domain_data",
        lambda *a, **k: ({"id": "1", "updated_at": "t1"}, "obj"),
    )
    settings = Settings(dsc_cache_dir=str(tmp_path), dsc_cache_revalidate_seconds=300)
    cache = DomainCache(settings)
    cache.get_asset("dom", "navmesh_v1", "obj")
    assert (tmp_path / "dom" / "navmesh_v1.obj").exists()
    cache.clear("dom")
    assert not (tmp_path / "dom").exists()
