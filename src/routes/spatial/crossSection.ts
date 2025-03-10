import { Context } from "jsr:@oak/oak/context";
import { fetchDomainDataByNameAndType } from "../../utils/domain/fetchDomainData.ts";
import { DomainRequestBody } from "../../types/domainRequestBody.ts";
import { ParseOBJString } from "../../utils/parse/objParser.ts";
import { SetGeometryFromOBJ } from "../../utils/math/geometry.ts";
// @deno-types="npm:@types/three"
import * as THREE from "npm:three";
import { MeshBVH } from "npm:three-mesh-bvh";
import { encode, ColorType } from "https://deno.land/x/pngs@0.1.1/mod.ts";
import { BitmapEncoder } from "../../utils/parse/bmpEncoder.ts";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";
import { BITMAP } from "../../utils/parse/BITMAP.ts";

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
  fileType?: "png" | "stcm" | "bmp" | string;
};

const crossSection = async (ctx: Context): Promise<void> => {
  //parse the request body
  const body: DomainRequestBody & CrossSectionRequest =
    await ctx.request.body.json();
  const { domainServerUrl, domainId, height, fileType } = body;
  //get auth header
  const authorization = ctx.request.headers.get("Authorization");
  //input guards
  try {
    //ensure we have all required body parameters
    if (!domainServerUrl) throw new Error("Missing domain server url");
    if (!domainId) throw new Error("Missing domain id");
    if (height === undefined) throw new Error("Missing height");
    if (fileType === undefined) throw new Error("Missing file type");
    if (fileType !== "png" && fileType !== "stcm" && fileType !== "bmp")
      throw new Error("Invalid file type");
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

  const img = new BITMAP(pngSize.x, pngSize.y);

  if (showAxes) {
    //red line x axis
    img.drawLine(0, Math.round(-offset.y * ppm), pngSize.x, 1, xAxisColor);

    //green line z axis
    img.drawLine(Math.round(-offset.x * ppm), 0, 1, pngSize.y, yAxisColor);

    //yellow point origin
    img.drawLine(
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
        img
      );
    }
  });

  const yamlLines = [
    "free_thresh: 0.196",
    "negate: 0",
    "occupied_thresh: 0.65",
    `image: map.${fileType == "stcm" ? "bmp" : fileType}`,
    "origin: ",
    `- ${minX.toFixed(3)}`,
    `- ${(-maxY).toFixed(3)}`,
    "- 0",
    `resolution: ${(1 / ppm).toString()}`,
  ];

  const yamlString = yamlLines.join("\n");
  if (fileType === "png") {
    const encodedPngData = encode(img.buffer, img.width, img.height, {
      color: ColorType.RGB,
    });
    const png64 = encodeBase64(encodedPngData);

    const formData = new FormData();
    formData.append("img", png64, "map.png");
    formData.append("yaml", yamlString, "map.yaml");

    ctx.response.body = formData;
    ctx.response.status = 200;
    return;
  }

  if (fileType === "stcm" || fileType === "bmp") {
    const formData = new FormData();
    const bmp = new BitmapEncoder({
      data: img.buffer,
      width: img.width,
      height: img.height,
    }).encode();

    if (fileType === "bmp") {
      const bmp64 = encodeBase64(bmp);
      formData.append("img", bmp64, "map.bmp");
      formData.append("yaml", yamlString, "map.yaml");

      ctx.response.body = formData;
      ctx.response.status = 200;
      return;
    }

    if (fileType == "stcm") {
      const tempDir = Deno.makeTempDirSync();
      try {
        const tempYamlPath = `${tempDir}/map.yaml`;
        const tempBmpPath = `${tempDir}/map.bmp`;
        const outputPath = `${tempDir}/map.stcm`;

        Deno.writeTextFileSync(tempYamlPath, yamlString);
        Deno.writeFileSync(tempBmpPath, bmp);

        //const size = Deno.statSync(tempBmpPath);
        //console.log("bmp size", size);

        const command = new Deno.Command(`./stcm_creater`, {
          args: ["-f", tempYamlPath, "-o", outputPath],
          stderr: "piped",
        });

        try {
          const process = command.spawn();
          console.log("process", process);
          const { success, stderr } = await process.output();
          console.log("success", success);
          console.log("stderr", stderr);
          if (!success) {
            throw new Error(new TextDecoder().decode(stderr));
          }
          console.log("waiting for file to be written");
          // Wait a small amount to ensure file is written
          await new Promise((resolve) => setTimeout(resolve, 100));

          console.log("reading file");
          const size = Deno.statSync(outputPath);
          console.log("stcm size", size);
          const stcm = await Deno.readFile(outputPath);
          console.log("encoding file");
          const stcm64 = encodeBase64(stcm);
          console.log("encoding done");
          formData.append("img", stcm64, "map.stcm");
          formData.append("yaml", yamlString, "map.yaml");

          ctx.response.body = formData;
          ctx.response.status = 200;
        } catch (e) {
          ctx.response.body = { errorMessage: e.message };
          ctx.response.status = 500;
        } finally {
          Deno.removeSync(tempDir, { recursive: true });
        }
      } catch (e) {
        ctx.response.body = { errorMessage: e.message };
        ctx.response.status = 500;
      }
    }
  }
};

function drawLineOnImage(
  start: THREE.Vector2,
  end: THREE.Vector2,
  offset: THREE.Vector2,
  ppm: number,
  color: number,
  thickness: number,
  png: BITMAP
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

export default crossSection;
