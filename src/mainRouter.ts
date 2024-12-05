import { Router } from "jsr:@oak/oak/router";
import setAsCanonical from "./routes/domain/setAsCanonical.ts";
import raycast from "./routes/spatial/raycast.ts";

const router = new Router();

router.get("/ping", ({ response }) => {
  response.body = "pong";
  response.status = 200;
});

router.post("/domain/setcanonrefinement", setAsCanonical);
router.post("/spatial/raycast", raycast);

export default router;
