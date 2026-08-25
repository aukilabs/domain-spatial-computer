from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from uuid import uuid4

from pydantic_settings import BaseSettings, SettingsConfigDict

_DSC_DIR = Path(__file__).resolve().parents[2]  # python/
_REPO_ROOT = _DSC_DIR.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(_DSC_DIR / ".env", _REPO_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    auki_api_url: str = ""
    auki_dds_url: str = ""
    auki_app_key: str = ""
    auki_app_secret: str = ""
    dsc_cache_dir: str = ""
    dsc_cache_revalidate_seconds: int = 300
    stcm_creater: str = ""
    client_id: str = ""

    def model_post_init(self, __context) -> None:
        if not self.client_id:
            object.__setattr__(self, "client_id", str(uuid4()))

    @property
    def cache_dir(self) -> Path:
        if self.dsc_cache_dir:
            return Path(self.dsc_cache_dir).expanduser()
        return _DSC_DIR / ".cache" / "domains"

    @property
    def repo_root(self) -> Path:
        return _REPO_ROOT


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


def reset_settings() -> None:
    get_settings.cache_clear()
