import { assertEquals, assertThrows } from "@std/assert";
import { Application } from "jsr:@oak/oak/application";
import { addSwaggerRoutes } from "./swagger.ts";
import { loadSwaggerConfig } from "./swaggerConfig.ts";

Deno.test("Swagger config is off by default and rejects incomplete auth", () => {
  assertEquals(loadSwaggerConfig(() => undefined).enabled, false);
  for (
    const values of [
      { SWAGGER_ENABLED: "maybe" },
      { SWAGGER_BASIC_AUTH_USERNAME: "docs" },
      { SWAGGER_BASIC_AUTH_PASSWORD: "secret" },
      {
        SWAGGER_BASIC_AUTH_USERNAME: "bad:name",
        SWAGGER_BASIC_AUTH_PASSWORD: "secret",
      },
    ]
  ) {
    assertThrows(() =>
      loadSwaggerConfig((name) =>
        (values as Record<string, string | undefined>)[name]
      )
    );
  }
});

Deno.test("Swagger UI and schema obey enable flag and Basic Auth", async () => {
  for (const path of ["/swagger", "/api-docs"]) {
    for (
      const test of [
        { enabled: false, auth: false, header: "", want: 404 },
        { enabled: true, auth: false, header: "", want: 200 },
        { enabled: true, auth: true, header: "", want: 401 },
        { enabled: true, auth: true, header: "Basic !!!", want: 401 },
        {
          enabled: true,
          auth: true,
          header: "Basic " + btoa("wrong:secret"),
          want: 401,
        },
        {
          enabled: true,
          auth: true,
          header: "Basic " + btoa("docs:wrong"),
          want: 401,
        },
        {
          enabled: true,
          auth: true,
          header: "Basic " + btoa("docs:secret"),
          want: 200,
        },
        {
          enabled: true,
          auth: true,
          header: "basic " + btoa("docs:secret"),
          want: 200,
        },
      ]
    ) {
      const values: Record<string, string> = {
        SWAGGER_ENABLED: String(test.enabled),
      };
      if (test.auth) {
        values.SWAGGER_BASIC_AUTH_USERNAME = "docs";
        values.SWAGGER_BASIC_AUTH_PASSWORD = "secret";
      }
      const app = new Application();
      addSwaggerRoutes(app, loadSwaggerConfig((name) => values[name]));
      app.use((ctx) => {
        if (ctx.request.url.pathname === "/ping") ctx.response.status = 204;
      });
      const response = await app.handle(
        new Request("http://localhost" + path, {
          headers: { Authorization: test.header },
        }),
      );
      assertEquals(
        response?.status,
        test.want,
        `${path}: ${JSON.stringify(test)}`,
      );
      if (test.want === 401) {
        assertEquals(
          response?.headers.get("WWW-Authenticate"),
          'Basic realm="Swagger", charset="UTF-8"',
        );
      }
      if (test.want === 200 && path === "/api-docs") {
        assertEquals((await response?.json()).openapi, "3.0.0");
      }
      const health = await app.handle(new Request("http://localhost/ping"));
      assertEquals(health?.status, 204);
    }
  }
});
