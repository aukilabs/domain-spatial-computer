import { Context } from "jsr:@oak/oak/context";
import { fetchDomainDataByNameAndType } from "../../utils/domain/fetchDomainData.ts";
import { DomainRequestBody } from "../../types/domainRequestBody.ts";
import { ParseOBJString } from "../../utils/parse/objParser.ts";
import { SetGeometryFromOBJ } from "../../utils/math/geometry.ts";
// @deno-types="npm:@types/three"
import * as THREE from "npm:three";
import { MeshBVH } from "npm:three-mesh-bvh";
import { encode, ColorType } from "https://deno.land/x/pngs@0.1.1/mod.ts";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";

type CrossSectionRequest = {
  height?: number;
  pixelsPerMeter?: number;
  includeOrigin?: boolean;
  lineThickness?: number;
  lineColor?: string;
  showAxes?: boolean;
  xAxisColor?: string;
  yAxisColor?: string;
  originColor?: string;
  buffer?: number;
};

const crossSection = async (ctx: Context): Promise<void> => {
  //parse the request body
  const body: DomainRequestBody & CrossSectionRequest =
    await ctx.request.body.json();
  const { domainServerUrl, domainId, height } = body;
  //get auth header
  const authorization = ctx.request.headers.get("Authorization");
  //input guards
  try {
    //ensure we have all required body parameters
    if (!domainServerUrl) throw new Error("Missing domain server url");
    if (!domainId) throw new Error("Missing domain id");
    if (height === undefined) throw new Error("Missing height");
    //ensure we have an auth token
    if (!authorization) throw new Error("Missing authorization");
  } catch (error) {
    ctx.response.status = 400;
    //@ts-expect-error check for .message on unknown
    ctx.response.body = { message: error.message ?? error };
    return;
  }

  const showAxes = !!body.showAxes;
  const ppm = Math.max(1, Math.min(body.pixelsPerMeter ?? 20, 200)); //1 pixel per 5mm
  const xAxisColor = body.xAxisColor ? hex2rgb(body.xAxisColor) : 0xff0000;
  const yAxisColor = body.yAxisColor ? hex2rgb(body.yAxisColor) : 0x00ff00;
  const originColor = body.originColor ? hex2rgb(body.originColor) : 0xffff00;
  const lineColor = body.lineColor ? hex2rgb(body.lineColor) : 0x000000;
  const lineThickness = body.lineThickness ?? 1;
  const imgBuffer = body.buffer ?? 0;

  //call the domain data endpoint to get the refinement manifest
  let occlusion_obj;
  try {
    const occlusionResponse = await fetchDomainDataByNameAndType({
      domainServerUrl,
      domainId,
      authorization,
      dataName: "occlusionmesh_v1",
      dataType: "obj",
    });

    //parse the refinement
    occlusion_obj = ParseOBJString(occlusionResponse.data);
  } catch (error) {
    //@ts-expect-error unknown error type
    ctx.response.body = { message: error.message };
    ctx.response.status = 500;
    return;
  }

  const tempLine = new THREE.Line3();
  const tempVector = new THREE.Vector3();
  const tempVector1 = new THREE.Vector3();
  const tempVector2 = new THREE.Vector3();
  const tempVector3 = new THREE.Vector3();
  const clippingPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), height);

  const occlusionIntersections = occlusion_obj.map((obj) => {
    const geo = new THREE.BufferGeometry();
    SetGeometryFromOBJ(obj, geo);
    const colliderBvh = new MeshBVH(geo, { maxLeafTris: 3 });

    const posAttr = new THREE.BufferAttribute(
      new Float32Array(16 * 3),
      3,
      false
    );

    let index = 0;
    colliderBvh.shapecast({
      intersectsBounds: (box) => {
        return clippingPlane.intersectsBox(box);
      },

      intersectsTriangle: (tri) => {
        // check each triangle edge to see if it intersects with the plane. If so then
        // add it to the list of segments.
        let count = 0;

        tempLine.start.copy(tri.a);
        tempLine.end.copy(tri.b);
        if (clippingPlane.intersectLine(tempLine, tempVector)) {
          posAttr.setXYZ(index, tempVector.x, tempVector.y, tempVector.z);
          index++;
          count++;
        }

        tempLine.start.copy(tri.b);
        tempLine.end.copy(tri.c);
        if (clippingPlane.intersectLine(tempLine, tempVector)) {
          posAttr.setXYZ(index, tempVector.x, tempVector.y, tempVector.z);
          count++;
          index++;
        }

        tempLine.start.copy(tri.c);
        tempLine.end.copy(tri.a);
        if (clippingPlane.intersectLine(tempLine, tempVector)) {
          posAttr.setXYZ(index, tempVector.x, tempVector.y, tempVector.z);
          count++;
          index++;
        }

        // When the plane passes through a vertex and one of the edges of the triangle, there will be three intersections, two of which must be repeated
        if (count === 3) {
          tempVector1.fromBufferAttribute(posAttr, index - 3);
          tempVector2.fromBufferAttribute(posAttr, index - 2);
          tempVector3.fromBufferAttribute(posAttr, index - 1);
          // If the last point is a duplicate intersection
          if (
            tempVector3.equals(tempVector1) ||
            tempVector3.equals(tempVector2)
          ) {
            count--;
            index--;
          } else if (tempVector1.equals(tempVector2)) {
            // If the last point is not a duplicate intersection
            // Set the penultimate point as a distinct point and delete the last point
            posAttr.setXYZ(
              index - 2,
              tempVector3.x,
              tempVector3.y,
              tempVector3.z
            );
            count--;
            index--;
          }
        }

        // If we only intersected with one or three sides then just remove it. This could be handled
        // more gracefully.
        if (count !== 2) {
          index -= count;
        }
      },
    });

    geo.computeBoundingBox();
    const bounds = geo.boundingBox!;
    const name = obj.name;
    geo.dispose();
    return { posAttr, bounds, name, index };
  });

  let minX = Number.MAX_VALUE;
  let maxX = Number.MIN_VALUE;
  let minY = Number.MAX_VALUE;
  let maxY = Number.MIN_VALUE;

  occlusionIntersections.forEach((o) => {
    minX = Math.min(minX, o.bounds.min.x, o.bounds.max.x);
    maxX = Math.max(maxX, o.bounds.min.x, o.bounds.max.x);
    minY = Math.min(minY, o.bounds.min.z, o.bounds.max.z);
    maxY = Math.max(maxY, o.bounds.min.z, o.bounds.max.z);
  });

  minX -= imgBuffer;
  minY -= imgBuffer;
  maxX += imgBuffer;
  maxY += imgBuffer;

  const size = new THREE.Vector2(maxX - minX, maxY - minY);
  const offset = new THREE.Vector2(minX, minY);
  const pngSize = new THREE.Vector2(
    Math.ceil(size.x * ppm),
    Math.ceil(size.y * ppm)
  );

  const png = new PNG(pngSize.x, pngSize.y);

  if (showAxes) {
    //red line x axis
    png.drawLine(0, Math.round(-offset.y * ppm), pngSize.x, 1, xAxisColor);

    //green line z axis
    png.drawLine(Math.round(-offset.x * ppm), 0, 1, pngSize.y, yAxisColor);

    //yellow point origin
    png.drawLine(
      Math.round(-offset.x * ppm),
      Math.round(-offset.y * ppm),
      1,
      1,
      originColor
    );
  }

  occlusionIntersections.forEach((o) => {
    for (let i = 0; i < o.index; i += 2) {
      const pos3d = new THREE.Vector2(o.posAttr.getX(i), o.posAttr.getZ(i));
      const pos3d2 = new THREE.Vector2(
        o.posAttr.getX(i + 1),
        o.posAttr.getZ(i + 1)
      );

      drawLineOnImage(
        new THREE.Vector2(pos3d.x, pos3d.y),
        new THREE.Vector2(pos3d2.x, pos3d2.y),
        offset,
        ppm,
        lineColor,
        lineThickness,
        png
      );
    }
  });

  const yamlLines = [
    "free_thresh: 0.196",
    "negate: 0",
    "occupied_thresh: 0.65",
    "image: map.png",
    "origin:",
    `- ${minX.toFixed(3)}`,
    `- ${(-maxY).toFixed(3)}`,
    "- 0",
    `resolution: ${(1 / ppm).toString()}`,
  ];

  const yamlString = yamlLines.join("\n");
  const encodedPngData = encode(png.buffer, png.width, png.height, {
    color: ColorType.RGB,
  });
  const png64 = encodeBase64(encodedPngData);

  const formData = new FormData();
  formData.append("png", png64, "map.png");
  formData.append("yaml", yamlString, "map.yaml");

  ctx.response.body = formData;
  ctx.response.status = 200;
};

function drawLineOnImage(
  start: THREE.Vector2,
  end: THREE.Vector2,
  offset: THREE.Vector2,
  ppm: number,
  color: number,
  thickness: number,
  png: PNG
) {
  const startOffset = start.sub(offset).multiplyScalar(ppm);
  const endOffset = end.sub(offset).multiplyScalar(ppm);
  const distance = startOffset.distanceTo(endOffset);
  if (distance == 0) return;

  const point = new THREE.Vector2();
  for (let i = 0; i < distance; i += 1) {
    point.lerpVectors(startOffset, endOffset, i / distance);
    const x = Math.floor(point.x);
    const y = Math.floor(point.y);

    png.drawLine(
      x - thickness / 2,
      y - thickness / 2,
      thickness,
      thickness,
      color
    );
  }
}

const hex2rgb = (hex: string) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  // return {r, g, b}
  return (1 << 24) | (r << 16) | (g << 8) | b;
};

class PNG {
  buffer: Uint8Array;
  width: number;
  height: number;

  constructor(width: number, height: number) {
    this.width = Math.floor(width);
    this.height = Math.floor(height);
    this.buffer = new Uint8Array(width * height * 3);
    this.buffer.fill(0xff);
  }

  setPixel(x: number, y: number, color: number) {
    x = Math.floor(x);
    y = Math.floor(y);
    const red = (color >> 16) & 0xff;
    const green = (color >> 8) & 0xff;
    const blue = color & 0xff;
    const index = x * 3 + this.width * 3 * y;
    this.buffer[index] = red;
    this.buffer[index + 1] = green;
    this.buffer[index + 2] = blue;
  }

  drawRect(x1: number, y1: number, x2: number, y2: number, color: number) {
    this.drawLine(x1, y1, x2 - x1, y2 - y1, color);
  }

  drawLine(x: number, y: number, width: number, height: number, color: number) {
    for (let i = 0; i < width; i++) {
      for (let j = 0; j < height; j++) {
        this.setPixel(x + i, y + j, color);
      }
    }
  }
}

export default crossSection;
