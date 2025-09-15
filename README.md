# Domain Spatial Computer

High-performance spatial computing API providing pathfinding, raycasting, and navigation mesh operations for 3D environments.

## Installation
Install deno - https://docs.deno.com/runtime/getting_started/installation

## Quick Start

```bash
# Set up environment
touch .env  # Add required Auki API credentials

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
```

## API Documentation

- **Swagger UI**: `http://localhost:8000/swagger`
- **OpenAPI Spec**: `http://localhost:8000/api-docs`

## API Endpoints

**Spatial Operations:**
- `POST /spatial/findpath` - Find path between waypoints
- `POST /spatial/findoptimizedpath` - Find optimized path with route optimization  
- `POST /spatial/restricttonavmesh` - Restrict point to navigation mesh
- `POST /spatial/raycast` - Perform raycast against occlusion geometry
- `POST /spatial/crosssection` - Generate 2D cross-section maps

**Utility:**
- `GET /ping` - Health check

## Testing

```bash
# Run all tests
deno test

# Run specific test
deno test src/utils/math/matrixMath.test.ts

```

Tests are co-located with source files (`.test.ts` extension).

## Docker Deployment

```bash
# Quick start
docker compose up --build

# Background
docker compose up -d --build

# Direct Docker
docker build -t domain-spatial-computer .
docker run -p 8000:8000 --env-file .env domain-spatial-computer
```

## Development

**Available tasks:**
- `deno task dev` - Start development server  
- `deno test` - Run tests

**Adding endpoints:**
1. Create endpoint in `src/routes/`
2. Register in `src/mainRouter.ts` 
3. Update `swagger.yaml`

**Project structure:**
- `src/routes/` - API endpoints
- `src/utils/` - Shared utilities  
- `src/types/` - TypeScript definitions
- Tests co-located with source files
