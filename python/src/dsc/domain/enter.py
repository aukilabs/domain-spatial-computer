from __future__ import annotations

import httpx

from dsc.config import Settings, get_settings
from dsc.domain.auth import get_dds_access_token


def enter_domain(
    domain_id: str, settings: Settings | None = None
) -> tuple[str, str]:
    settings = settings or get_settings()
    dds_token = get_dds_access_token(settings)
    url = f"{settings.auki_dds_url.rstrip('/')}/api/v1/domains/{domain_id}/auth"
    headers = {
        "Authorization": f"Bearer {dds_token}",
        "posemesh-client-id": settings.client_id,
        "Content-Type": "application/json",
    }
    response = httpx.post(url, headers=headers, timeout=30.0)
    if not response.is_success:
        raise RuntimeError(f"HTTP error! status: {response.status_code}")
    body = response.json()
    return f"Bearer {body['access_token']}", body["domain_server"]["url"]
