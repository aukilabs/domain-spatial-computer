import { Application } from "jsr:@oak/oak/application";
import { Router } from "jsr:@oak/oak/router";
import { parse } from "https://deno.land/std@0.208.0/yaml/mod.ts";

let swaggerSpec: any = null;

async function loadSwaggerSpec() {
  if (!swaggerSpec) {
    try {
      const yamlContent = await Deno.readTextFile("./swagger.yaml");
      swaggerSpec = parse(yamlContent);
    } catch (error) {
      console.error("Failed to load swagger.yaml:", error);
      // Fallback to minimal spec
      swaggerSpec = {
        openapi: "3.0.0",
        info: {
          title: "Spatial Computer API",
          description:
            "API for spatial pathfinding, raycasting, and navigation mesh operations",
          version: "1.0.0",
        },
        servers: [
          {
            url: "http://localhost:8000",
            description: "Development server",
          },
        ],
        paths: {},
      };
    }
  }
  return swaggerSpec;
}

export function addSwaggerRoutes(app: Application) {
  const swaggerRouter = new Router();

  // Serve the OpenAPI spec JSON
  swaggerRouter.get("/api-docs", async (ctx) => {
    const spec = await loadSwaggerSpec();
    ctx.response.headers.set("Content-Type", "application/json");
    ctx.response.body = JSON.stringify(spec, null, 2);
  });

  // Serve Swagger UI HTML
  swaggerRouter.get("/swagger", (ctx) => {
    ctx.response.headers.set("Content-Type", "text/html");
    ctx.response.body = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Spatial Computer API Documentation</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.10.3/swagger-ui.css" />
  <style>
    html {
      box-sizing: border-box;
      overflow: -moz-scrollbars-vertical;
      overflow-y: scroll;
    }
    *, *:before, *:after {
      box-sizing: inherit;
    }
    body {
      margin:0;
      background: #fafafa;
    }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.10.3/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.10.3/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      const ui = SwaggerUIBundle({
        url: '/api-docs',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout"
      });
    };
  </script>
</body>
</html>
    `;
  });

  app.use(swaggerRouter.routes());
  app.use(swaggerRouter.allowedMethods());
}
