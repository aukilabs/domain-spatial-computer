import { Application } from "jsr:@oak/oak/application";
import router from "./mainRouter.ts";
import { oakCors } from "https://deno.land/x/cors/mod.ts";

const app = new Application();

app.use(oakCors({ origin: "*", optionsSuccessStatus: 200 }));
app.use(router.routes());
app.use(router.allowedMethods());

console.log("server running on port 8000");

await app.listen({ port: 8000 });
