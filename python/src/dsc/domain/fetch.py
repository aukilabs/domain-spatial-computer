from __future__ import annotations

from typing import Any

import httpx


def fetch_domain_metadata(
    domain_server_url: str,
    domain_id: str,
    authorization: str,
    data_name: str,
    data_type: str,
) -> dict[str, Any]:
    url = (
        f"{domain_server_url.rstrip('/')}/api/v1/domains/{domain_id}/data"
        f"?name={data_name}&data_type={data_type}"
    )
    response = httpx.get(
        url, headers={"Authorization": authorization}, timeout=60.0
    )
    response.raise_for_status()
    listing = response.json()
    data = listing.get("data") or []
    if not data:
        raise RuntimeError("no domain data metadata")
    return data[0]


def fetch_domain_data(
    domain_server_url: str,
    domain_id: str,
    authorization: str,
    data_name: str,
    data_type: str,
    metadata: dict[str, Any] | None = None,
) -> tuple[dict[str, Any], str]:
    metadata = metadata or fetch_domain_metadata(
        domain_server_url, domain_id, authorization, data_name, data_type
    )
    url = (
        f"{domain_server_url.rstrip('/')}/api/v1/domains/{domain_id}/data/"
        f"{metadata['id']}?raw=1"
    )
    response = httpx.get(
        url,
        headers={
            "accept": "multipart/form-data",
            "Authorization": authorization,
        },
        timeout=120.0,
    )
    if response.status_code != 200:
        print(response.status_code)
        print(response.text)
        raise RuntimeError()
    return metadata, response.text
