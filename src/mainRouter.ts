import { Router } from "jsr:@oak/oak/router";
import raycast from "./routes/spatial/raycast.ts";

import crossSection from "./routes/spatial/crossSection.ts";
import restrictToNavmesh from "./routes/spatial/restrictToNavmesh.ts";
import findPath from "./routes/spatial/findPath.ts";
import findOptimizedPath from "./routes/spatial/findOptimizedPath.ts";

const router = new Router();

//lazy health check
router.get("/ping", ({ response }) => {
  console.log("ping");
  response.body = "pong";
  response.status = 200;
});

//new endpoints (do self appkey:secret authentication)
router.post("/spatial/findpath", findPath);
router.post("/spatial/findoptimizedpath", findOptimizedPath);
router.post("/spatial/restricttonavmesh", restrictToNavmesh);
router.post("/spatial/raycast", raycast);
router.post("/spatial/crosssection", crossSection);

export default router;
