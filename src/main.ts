import env from "../config.ts";
import { Application } from "jsr:@oak/oak/application";
import router from "./mainRouter.ts";
import { oakCors } from "https://deno.land/x/cors/mod.ts";

const app = new Application();

app.use(oakCors({ origin: "*", optionsSuccessStatus: 200 }));
app.use(router.routes());
app.use(router.allowedMethods());

console.log("server running on port", env.PORT);

await app.listen({ port: Number(env.PORT) });
