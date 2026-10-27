# Domain Spatial Computer

High-performance spatial computing API providing pathfinding, raycasting, and navigation mesh operations for 3D environments.

## Installation
Install deno - https://docs.deno.com/runtime/getting_started/installation

## Quick Start

```bash
# Set up environment
touch .env  # Add required Auki API credentials and API key

# Run development server
deno task dev

# Run tests
deno test
```

## Environment Configuration

Create `.env` file:

```env
PORT=8000
AUKI_API_URL=https://api.auki.network
AUKI_DDS_URL=https://dds.auki.network
AUKI_APP_KEY=your_app_key
AUKI_APP_SECRET=your_app_secret
DSC_API_KEY=your_secure_api_key
```

## API Documentation

Documentation routes are disabled by default. See the Swagger access configuration below to enable them.

- **Swagger UI**: `http://localhost:8000/swagger`
- **OpenAPI Spec**: `http://localhost:8000/api-docs`

## API Endpoints

**Public Endpoints:**
- `GET /ping` - Health check (no authentication required)

**Protected Spatial Operations** (require API key):
- `POST /spatial/findpath` - Find path between waypoints
- `POST /spatial/findoptimizedpath` - Find optimized path with route optimization  
- `POST /spatial/restricttonavmesh` - Restrict point to navigation mesh
- `POST /spatial/raycast` - Perform raycast against occlusion geometry
- `POST /spatial/crosssection` - Generate 2D cross-section maps

## Authentication

All spatial endpoints require API key authentication using the `x-api-key` header. The API key is configured via the `DSC_API_KEY` environment variable.

```bash
# API key authentication
curl -H "x-api-key: your_api_key" http://localhost:8000/spatial/findpath
```

**Note:** If `DSC_API_KEY` is not set, API authentication will be disabled (development mode).

## Example Usage

```bash
# Test connectivity (no auth required)
curl http://localhost:8000/ping

# Find path between points (requires API key)
curl -X POST http://localhost:8000/spatial/findpath \
  -H "Content-Type: application/json" \
  -H "x-api-key: your_api_key" \
  -d '{
    "domainId": "your-domain-id",
    "wayPoints": [
      {"x": 0, "y": 0, "z": 0},
      {"x": 10, "y": 0, "z": 10}
    ],
    "radius": 0.5
  }'
```

## Testing

```bash
# Run all tests
deno test

# Run specific test
deno test src/utils/math/matrixMath.test.ts
```

Tests are co-located with source files (`.test.ts` extension).

## Docker Deployment

1. Copy `docker-compose.yml.example` to `docker-compose.yml`
2. Add your Auki credentials and API key to `docker-compose.yml`

```bash
# Quick start
docker compose up --build

# Background
docker compose up -d --build

# Direct Docker
docker build -t domain-spatial-computer .
docker run -p 8000:8000 --env-file .env domain-spatial-computer
```

**Required environment variables:**
- `AUKI_APP_KEY` - Your Auki application key
- `AUKI_APP_SECRET` - Your Auki application secret  
- `DSC_API_KEY` - Your API key for endpoint protection

## Development

**Available tasks:**
- `deno task dev` - Start development server  
- `deno test` - Run tests

**Adding endpoints:**
1. Create endpoint in `src/routes/`
2. Add authentication middleware in `src/mainRouter.ts` 
3. Update `swagger.yaml` with security requirements

**Project structure:**
- `src/routes/` - API endpoints
- `src/utils/` - Shared utilities  
- `src/types/` - TypeScript definitions
- Tests co-located with source files

## Swagger access

Swagger is enabled only by the dev chart values. All dev services use the same
shared team login from the `swagger-docs` Kubernetes Secret in namespace `default`
(keys `username` and `password`). Base, staging, and production values disable it.

The dev values already map those keys to `SWAGGER_BASIC_AUTH_USERNAME` and
`SWAGGER_BASIC_AUTH_PASSWORD`, with `SWAGGER_ENABLED: "true"`. Provision the one
shared Secret before rolling out the updated service images. No per-user accounts
or separate credentials per service are needed. Rotating the shared login means
updating that Secret and restarting the dev workloads.

The Basic Auth check covers the documentation UI, assets, and JSON schema.
Health routes and normal API authentication are independent. Credentials are not
stored in Helm values or this repository. Missing Secret keys prevent the dev
pods from starting instead of silently omitting the configured authentication.

For local use, the same environment variables are supported. `SWAGGER_ENABLED`
defaults to `false`. If enabled without either credential, docs are public;
configure both for shared use. Partial credentials or a username containing `:`
fail startup validation.

The UI is `/swagger` and the schema is `/api-docs`. Dev selects `values.dev.yaml`
through `domain_spatial_computer_values_file` in `terraform-live`.
