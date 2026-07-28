import { ParsedOBJModel } from "../parse/objParser.ts";

type Vector3 = { x: number; y: number; z: number };

export type AreaBounds = {
  xMin?: number;
  xMax?: number;
  zMin?: number;
  zMax?: number;
};

function isInArea(point: Vector3, area: AreaBounds): boolean {
  if (area.xMin !== undefined && point.x < area.xMin) return false;
  if (area.xMax !== undefined && point.x > area.xMax) return false;
  if (area.zMin !== undefined && point.z < area.zMin) return false;
  if (area.zMax !== undefined && point.z > area.zMax) return false;
  return true;
}

// Returns the two (x, z) points at the ends of the principal axis of a set of vertices,
// found via eigen-decomposition of their 2D (x, z) covariance matrix.
function longAxisEndpoints(vertices: Vector3[]): { wp1: [number, number]; wp2: [number, number] } {
  const n = vertices.length;
  let cx = 0;
  let cz = 0;
  for (const v of vertices) {
    cx += v.x;
    cz += v.z;
  }
  cx /= n;
  cz /= n;

  let cxx = 0;
  let czz = 0;
  let cxz = 0;
  for (const v of vertices) {
    const dx = v.x - cx;
    const dz = v.z - cz;
    cxx += dx * dx;
    czz += dz * dz;
    cxz += dx * dz;
  }
  const denom = Math.max(n - 1, 1);
  cxx /= denom;
  czz /= denom;
  cxz /= denom;

  // Largest eigenvalue/eigenvector of the symmetric 2x2 matrix [[cxx, cxz], [cxz, czz]]
  const trace = cxx + czz;
  const det = cxx * czz - cxz * cxz;
  const discriminant = Math.max(trace * trace / 4 - det, 0);
  const lambda1 = trace / 2 + Math.sqrt(discriminant);

  let ex: number;
  let ez: number;
  if (cxz !== 0) {
    ex = lambda1 - czz;
    ez = cxz;
  } else if (cxx >= czz) {
    ex = 1;
    ez = 0;
  } else {
    ex = 0;
    ez = 1;
  }
  const norm = Math.sqrt(ex * ex + ez * ez) || 1;
  ex /= norm;
  ez /= norm;

  let minProj = Infinity;
  let maxProj = -Infinity;
  for (const v of vertices) {
    const proj = (v.x - cx) * ex + (v.z - cz) * ez;
    if (proj < minProj) minProj = proj;
    if (proj > maxProj) maxProj = proj;
  }

  return {
    wp1: [cx + minProj * ex, cz + minProj * ez],
    wp2: [cx + maxProj * ex, cz + maxProj * ez],
  };
}

// Splits wp1->wp2 into evenly spaced points roughly `interval` metres apart.
function intervalWaypoints(
  wp1: [number, number],
  wp2: [number, number],
  interval: number
): [number, number][] {
  const dx = wp2[0] - wp1[0];
  const dz = wp2[1] - wp1[1];
  const distance = Math.sqrt(dx * dx + dz * dz);
  const segments = Math.floor(distance / interval);
  if (segments < 1) return [wp1, wp2];

  const points: [number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    points.push([wp1[0] + (i / segments) * dx, wp1[1] + (i / segments) * dz]);
  }
  return points;
}

// For each named mesh object in the navmesh OBJ, computes a literal path segment by
// finding its principal axis and sampling waypoints along it. Mirrors the domain_scan_path
// Python client's 'segment' waypoint mode, but runs server-side against the same parsed OBJ
// used to build the NavMesh — no separate client-side generation step needed.
export default function generateSegmentsFromMesh(
  models: ParsedOBJModel[],
  area?: AreaBounds,
  interval = 3.0
): Vector3[][] {
  const segments: Vector3[][] = [];

  for (const model of models) {
    const vertices: Vector3[] = [];
    for (let i = 0; i < model.vertices.length; i += 3) {
      const v = { x: model.vertices[i], y: model.vertices[i + 1], z: model.vertices[i + 2] };
      if (area && !isInArea(v, area)) continue;
      vertices.push(v);
    }
    if (vertices.length < 2) continue;

    const { wp1, wp2 } = longAxisEndpoints(vertices);
    const points2d = intervalWaypoints(wp1, wp2, interval);
    segments.push(points2d.map(([x, z]) => ({ x, y: 0, z })));
  }

  return segments;
}
