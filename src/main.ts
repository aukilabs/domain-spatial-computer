import { Application } from "jsr:@oak/oak/application";
import router from "./mainRouter.ts";
import { oakCors } from "https://deno.land/x/cors/mod.ts";
import { addSwaggerRoutes } from "./swagger.ts";

const app = new Application();

app.use(oakCors({ origin: "*", optionsSuccessStatus: 200 }));

// Add Swagger routes
addSwaggerRoutes(app);

app.use(router.routes());
app.use(router.allowedMethods());

//get port from env
const port = Number(Deno.env.get("PORT")) || 8000;
console.log("server running on port", port);
await app.listen({ port });
