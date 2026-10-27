import { createHash, timingSafeEqual } from "node:crypto";

export type SwaggerConfig = {
  enabled: boolean;
  authorizationHash?: Uint8Array;
};

export function loadSwaggerConfig(
  get: (name: string) => string | undefined = (name) => Deno.env.get(name),
): SwaggerConfig {
  const enabled = get("SWAGGER_ENABLED") ?? "false";
  if (enabled !== "true" && enabled !== "false") {
    throw new Error("SWAGGER_ENABLED must be true or false");
  }
  const username = get("SWAGGER_BASIC_AUTH_USERNAME") ?? "";
  const password = get("SWAGGER_BASIC_AUTH_PASSWORD") ?? "";
  if ((!username !== !password) || username.includes(":")) {
    throw new Error(
      "SWAGGER_BASIC_AUTH_USERNAME and SWAGGER_BASIC_AUTH_PASSWORD must be set together; username must not contain a colon",
    );
  }
  const encoded = btoa(
    Array.from(
      new TextEncoder().encode(`${username}:${password}`),
      (byte) => String.fromCharCode(byte),
    ).join(""),
  );
  return {
    enabled: enabled === "true",
    authorizationHash: username
      ? new Uint8Array(createHash("sha256").update(`Basic ${encoded}`).digest())
      : undefined,
  };
}

export function swaggerAuthorized(
  config: SwaggerConfig,
  header: string | null,
): boolean {
  if (!config.authorizationHash) return true;
  if (!header || !/^Basic /i.test(header)) return false;
  const actual = createHash("sha256").update(`Basic ${header.slice(6)}`)
    .digest();
  return timingSafeEqual(actual, config.authorizationHash);
}
