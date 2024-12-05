import { Context } from "jsr:@oak/oak/context";
import { DomainRequestBody } from "../../types/domainRequestBody.ts";
import { fetchDomainDataByNameAndType } from "../../utils/domain/fetchDomainData.ts";
import { updateDomainData } from "../../utils/domain/uploadDomainData.ts";
// @deno-types="npm:@types/three"
import * as THREE from "npm:three";
import {
  ApplyRelativeMatrixToPose,
  GetRelativeMatrix,
} from "../../utils/math/matrixMath.ts";

const setAsCanonical = async (ctx: Context): Promise<void> => {
  try {
    //parse the request body
    const body: DomainRequestBody & { refinementId?: string } =
      await ctx.request.body.json();
    const { domainServerUrl, domainId, refinementId } = body;
    //get auth header
    const authorization = ctx.request.headers.get("Authorization");
    //input guards
    try {
      //ensure we have all required body parameters
      if (!domainServerUrl) throw new Error("Missing domain server url");
      if (!domainId) throw new Error("Missing domain id");
      if (!refinementId) throw new Error("Missing refinement id");
      //ensure we have an auth token
      if (!authorization) throw new Error("Missing authorization");
    } catch (error) {
      ctx.response.status = 400;
      //@ts-expect-error check for .message on unknown
      ctx.response.body = { message: error.message ?? error };
      return;
    }

    //infer the data name for the manifest
    const refinementName = `refined_manifest_${refinementId}`;

    //call the domain data endpoint to get the refinement manifest
    let refinementManifest;
    try {
      const refinementResponse = await fetchDomainDataByNameAndType({
        domainServerUrl,
        domainId,
        authorization,
        dataName: refinementName,
        dataType: "refined_manifest_json",
      });
      //parse the refinement
      refinementManifest = JSON.parse(refinementResponse.data);
    } catch (error) {
      //@ts-expect-error unknown error type
      ctx.response.body = { message: error.message };
      ctx.response.status = 500;
      return;
    }

    const getExistingPortalsResponse = await fetch(
      `${domainServerUrl}/api/v1/domains/${domainId}/lighthouses`,
      {
        METHOD: "GET",
        headers: {
          Authorization: authorization,
          "Accept-Encoding": "application/json",
        },
      }
    );

    console.log(getExistingPortalsResponse.status);
    console.log(getExistingPortalsResponse.statusText);

    const existingPortals = await getExistingPortalsResponse.json();

    //get origin or closest thing to an origin
    let closestId: string | undefined = undefined;
    let closestDistance = Number.MAX_VALUE;
    console.log("existingPortals.poses.length", existingPortals.poses.length);
    for (let i = 0; i < existingPortals.poses.length; i++) {
      const data = existingPortals.poses[i];
      console.log(i, data);
      const x = data.px;
      const y = data.py;
      const z = data.pz;
      if (x === undefined || y === undefined || z === undefined) continue;
      const distanceSq = x * x * y * y * z * z;
      if (distanceSq < closestDistance) {
        closestDistance = distanceSq;
        closestId = data.short_id;
      }
    }

    console.log(closestId, closestDistance);

    //align refinement to the existing origin portal
    let refinementPortals = refinementManifest.portals ?? [];
    let relativeMatrix: THREE.Matrix4 | undefined = undefined;
    if (closestId) {
      const originPortal = existingPortals.poses.find(
        (x) => x.short_id == closestId
      );
      const refinementPortal = refinementManifest?.portals.find(
        (x) => x.shortId == closestId
      );

      if (originPortal && refinementPortal) {
        relativeMatrix = GetRelativeMatrix(
          {
            position: {
              x: originPortal.px!,
              y: originPortal.py!,
              z: originPortal.pz!,
            },
            rotation: {
              x: originPortal.rx!,
              y: originPortal.ry!,
              z: originPortal.rz!,
              w: originPortal.rw!,
            },
          },
          refinementPortal.averagePose
        );

        console.log(
          "closest",
          closestId,
          originPortal,
          refinementPortal.averagePose,
          relativeMatrix
        );

        refinementPortals = refinementPortals.map((x) => {
          const pose = ApplyRelativeMatrixToPose(relativeMatrix!, x.pose);
          const averagePose = ApplyRelativeMatrixToPose(
            relativeMatrix!,
            x.averagePose
          );
          return { ...x, pose, averagePose };
        });
      }
    }

    console.log("deleting portals");

    //delete all portal poses in the domain
    const deletePortalsResponse = await fetch(
      `${domainServerUrl}/api/v1/domains/${domainId}/lighthouses`,
      {
        method: "DELETE",
        headers: { Authorization: authorization },
      }
    );

    //bail out of there was an error deleting portals in the domain
    if (deletePortalsResponse.status !== 200) {
      ctx.response.body = {
        message: "failed to delete portals",
      };
      ctx.response.status = deletePortalsResponse.status;
      return;
    }

    console.log("placing portals");
    for (const portal of refinementPortals) {
      console.log("placing portals" + portal.shortId);
      const placeResponse = await fetch(
        `${domainServerUrl}/api/v1/domains/${domainId}/lighthouses/${portal.shortId}`,
        {
          method: "PUT",
          headers: {
            Authorization: authorization,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            pose: {
              px: portal.averagePose.position.x,
              py: portal.averagePose.position.y,
              pz: portal.averagePose.position.z,
              rx: portal.averagePose.rotation.x,
              ry: portal.averagePose.rotation.y,
              rz: portal.averagePose.rotation.z,
              rw: portal.averagePose.rotation.w,
              scanner_device_id: "unknown",
              scanner_device_name: "unknown",
              scanner_device_model: "unknown",
            },
          }),
        }
      );

      console.log(placeResponse.status);
      const placeresponse = await placeResponse.text();
      if (placeResponse.status !== 200) {
        console.log("error placing portal");
        console.log(placeResponse.status);
        ctx.response.status = placeResponse.status;
        ctx.response.body = {
          message: placeresponse,
        };
        return;
      }
    }

    let metadataObj: { [key: string]: any } = {};
    let domainMetadataId: string;
    try {
      const domainmetadataResponse = await fetchDomainDataByNameAndType({
        authorization,
        domainId,
        domainServerUrl,
        dataName: "domain_metadata",
        dataType: "json",
      });

      metadataObj = JSON.parse(domainmetadataResponse.data);
      domainMetadataId = domainmetadataResponse.metadata.id;
    } catch (error) {
      metadataObj = {};
    }

    metadataObj.canonicalRefinement = refinementId;
    metadataObj.canonicalRefinementAlignmentMatrix = relativeMatrix?.toArray();
    metadataObj.test = (metadataObj.test ?? 0) + 1;

    console.log(metadataObj);

    const updateResponse = await updateDomainData({
      authorization,
      domainServerUrl,
      domainId,
      dataId: domainMetadataId!,
      data: JSON.stringify(metadataObj),
    });

    if (updateResponse.status !== 200) {
      console.log("error updating canonical data");
    }

    ctx.response.status = 200;
    ctx.response.body = { message: "Success" };
  } catch (error) {
    console.log(error);
    ctx.response.status = 500;
    ctx.response.body = {
      message: "Something went wrong.",
      //@ts-expect-error check for .message on unknown
      error: error.message ?? error,
    };
  }
};

export default setAsCanonical;
