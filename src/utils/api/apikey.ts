export async function apiKeyAuth(ctx: any, next: () => Promise<unknown>) {
  const apiKey = ctx.request.headers.get("x-api-key");
  const validKey = Deno.env.get("DSC_API_KEY");

  if (!validKey) {
    //no key, skip auth
    await next();
    return;
  }

  if (!apiKey || apiKey !== validKey) {
    ctx.response.status = 401;
    ctx.response.body = { error: "Invalid or missing API key" };
    return;
  }

  await next();
}
