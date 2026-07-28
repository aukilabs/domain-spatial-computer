import { init } from "npm:@recast-navigation/core";
import { fetchDomainDataByNameAndType } from "../domain/fetchDomainData.ts";
import { SetGeometryFromOBJ } from "../math/geometry.ts";
import { ParseOBJString, ParsedOBJModel } from "../parse/objParser.ts";
import * as THREE from "npm:three";
import { threeToSoloNavMesh } from "npm:@recast-navigation/three";

export async function fetchNavmeshObj(
  domainServerUrl: string,
  domainId: string,
  authorization: string
): Promise<ParsedOBJModel[]> {
  const navmeshFile = await fetchDomainDataByNameAndType({
    domainServerUrl,
    domainId,
    authorization,
    dataName: "navmesh_v1",
    dataType: "obj",
  });

  return ParseOBJString(navmeshFile.data);
}

export async function buildNavMesh(navmesh_obj: ParsedOBJModel[], radius?: number) {
  const navmeshQuads = navmesh_obj.map((obj) => {
    const obj3d = new THREE.Mesh();
    obj3d.name = obj.name;
    obj3d.geometry = new THREE.BufferGeometry();
    obj3d.material = new THREE.MeshBasicMaterial();
    SetGeometryFromOBJ(obj, obj3d.geometry);
    return obj3d;
  });

  await init();

  return threeToSoloNavMesh(navmeshQuads, {
    walkableRadius: radius ?? 0,
    cs: 0.05,
    ch: 0.01,
    maxSimplificationError: 0.5,
    minRegionArea: 2,
    mergeRegionArea: 8,
    detailSampleDist: 2,
    detailSampleMaxError: 0.5,
    maxEdgeLen: 30,
  });
}

export async function loadNavmesh(
  domainServerUrl: string,
  domainId: string,
  authorization: string,
  radius?: number
) {
  let navmesh_obj;
  try {
    navmesh_obj = await fetchNavmeshObj(domainServerUrl, domainId, authorization);
  } catch (error) {
    return { success: false, navMesh: null };
  }

  return buildNavMesh(navmesh_obj, radius);
}
