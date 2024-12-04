import { Router } from "jsr:@oak/oak/router";
import setAsCanonical from "./routes/dmt/setAsCanonical.ts";

const router = new Router();

router.get("/ping", ({ response }) => {
  response.body = "pong";
  response.status = 200;
});

router.post("/dmt/canonical", setAsCanonical);

export default router;
