from __future__ import annotations

import os
import platform
import subprocess
import tempfile
from pathlib import Path

from dsc.config import get_settings


def resolve_stcm_creater() -> Path:
    settings = get_settings()
    if settings.stcm_creater:
        path = Path(settings.stcm_creater).expanduser()
        if path.exists():
            return path
        raise FileNotFoundError(settings.stcm_creater)

    machine = platform.machine().lower()
    if machine in {"x86_64", "amd64"}:
        arch = "amd64"
    elif machine in {"arm64", "aarch64"}:
        arch = "arm64"
    else:
        arch = machine

    candidates = [
        settings.repo_root / f"stcm_creater_{arch}",
        settings.repo_root / "stcm_creater",
        Path.cwd() / "stcm_creater",
        Path.cwd() / f"stcm_creater_{arch}",
    ]
    for candidate in candidates:
        if candidate.exists() and os.access(candidate, os.X_OK):
            return candidate
    for candidate in candidates:
        if candidate.exists():
            return candidate
    raise FileNotFoundError("stcm_creater binary not found")


def create_stcm(yaml_text: str, bmp_bytes: bytes) -> bytes:
    binary = resolve_stcm_creater()
    with tempfile.TemporaryDirectory() as temp_dir:
        yaml_path = Path(temp_dir) / "map.yaml"
        bmp_path = Path(temp_dir) / "map.bmp"
        output_path = Path(temp_dir) / "map.stcm"
        yaml_path.write_text(yaml_text)
        bmp_path.write_bytes(bmp_bytes)
        completed = subprocess.run(
            [str(binary), "-f", str(yaml_path), "-o", str(output_path)],
            capture_output=True,
            check=False,
        )
        if completed.returncode != 0:
            error = completed.stderr.decode(errors="replace")
            raise RuntimeError(error)
        return output_path.read_bytes()
