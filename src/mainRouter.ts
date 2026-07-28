import { Router } from "jsr:@oak/oak/router";
import raycast from "./routes/spatial/raycast.ts";

import crossSection from "./routes/spatial/crossSection.ts";
import restrictToNavmesh from "./routes/spatial/restrictToNavmesh.ts";
import findPath from "./routes/spatial/findPath.ts";
import findOptimizedPath from "./routes/spatial/findOptimizedPath.ts";
import findOptimizedSegmentPath from "./routes/spatial/findOptimizedSegmentPath.ts";
import { apiKeyAuth } from "./utils/api/apikey.ts";

const router = new Router();

//lazy health check
router.get("/ping", ({ response }) => {
  console.log("ping");
  response.body = "pong";
  response.status = 200;
});

//new endpoints (do self appkey:secret authentication)
router.post("/spatial/findpath", apiKeyAuth, findPath);
router.post("/spatial/findoptimizedpath", apiKeyAuth, findOptimizedPath);
router.post("/spatial/findoptimizedsegmentpath", apiKeyAuth, findOptimizedSegmentPath);
router.post("/spatial/restricttonavmesh", apiKeyAuth, restrictToNavmesh);
router.post("/spatial/raycast", apiKeyAuth, raycast);
router.post("/spatial/crosssection", apiKeyAuth, crossSection);

export default router;
