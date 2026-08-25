# Domain Spatial Computer (Python)

Python library for the same spatial operations as the Deno API. Other apps import and call functions — there is no HTTP server.

## Setup

```bash
cd python
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env   # add Auki credentials
```

Env is loaded from `python/.env` or the repo-root `.env`.

## Usage

```python
from dsc import (
    find_path,
    find_optimized_path,
    restrict_to_navmesh,
    raycast,
    cross_section,
    clear_cache,
    start_domain_watcher,
)

result = find_path(
    domain_id="your-domain-id",
    way_points=[{"x": 0, "y": 0, "z": 0}, {"x": 10, "y": 0, "z": 10}],
    radius=0.5,
)

optimized = find_optimized_path(
    domain_id="your-domain-id",
    way_points=[
        {"x": 0, "y": 0, "z": 0},
        {"x": 5, "y": 0, "z": 5},
        {"x": 10, "y": 0, "z": 10},
    ],
    radius=1.0,
    fixed_end=True,
)

start_domain_watcher()  # optional: poll domain metadata every 300s
find_path(..., refresh=True)  # force re-download
clear_cache(domain_id="your-domain-id")
```

Domain meshes are cached on disk and in memory. Every 300 seconds (configurable via `DSC_CACHE_REVALIDATE_SECONDS`) a metadata check looks for a newer file before re-downloading.

## Tests

```bash
pytest
```
