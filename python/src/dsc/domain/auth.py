from __future__ import annotations

import base64

import httpx

from dsc.config import Settings, get_settings


def get_dds_access_token(settings: Settings | None = None) -> str:
    settings = settings or get_settings()
    auth_string = f"{settings.auki_app_key}:{settings.auki_app_secret}"
    auth_b64 = base64.b64encode(auth_string.encode()).decode()
    url = f"{settings.auki_api_url.rstrip('/')}/service/domains-access-token"
    headers = {
        "Authorization": f"Basic {auth_b64}",
        "posemesh-client-id": settings.client_id,
    }
    response = httpx.post(url, headers=headers, timeout=30.0)
    if response.status_code != 200:
        print(f"Error getting domain access token, status code: {response.status_code}")
        return ""
    return response.json().get("access_token", "")
