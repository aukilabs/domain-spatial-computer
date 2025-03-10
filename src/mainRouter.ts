import { Router } from "jsr:@oak/oak/router";
import setAsCanonical from "./routes/domain/setAsCanonical.ts";
import raycast from "./routes/spatial/raycast.ts";
import pathFind from "./routes/spatial/pathfind.ts";
import crossSection from "./routes/spatial/crossSection.ts";
import restrictToNavmesh from "./routes/spatial/restrictToNavmesh.ts";

const router = new Router();

router.get("/ping", ({ response }) => {
  console.log("ping");
  response.body = "pong";
  response.status = 200;
});

router.post("/domain/setcanonrefinement", setAsCanonical);
router.post("/spatial/pathfind", pathFind);
router.post("/spatial/restricttonavmesh", restrictToNavmesh);
router.post("/spatial/raycast", raycast);
router.post("/spatial/crosssection", crossSection);

export default router;
