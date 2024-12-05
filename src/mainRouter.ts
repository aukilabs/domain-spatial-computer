import { Router } from "jsr:@oak/oak/router";
import setAsCanonical from "./routes/domain/setAsCanonical.ts";

const router = new Router();

router.get("/ping", ({ response }) => {
  response.body = "pong";
  response.status = 200;
});

router.post("/domain/setcanonrefinement", setAsCanonical);

export default router;
