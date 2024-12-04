import { Context } from "jsr:@oak/oak/context";
import { DomainRequestBody } from "../../types/domainRequestBody.ts";
import { fetchDomainDataByNameAndType } from "../../utils/fetchDomainData.ts";
import { updateDomainData } from "../../utils/uploadDomainData.ts";

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

    // const getExistingPortalsResponse = await fetch(
    //   `${domainServerUrl}/api/v1/domains/${domainId}/lighthouses`,
    //   { METHOD: "GET", headers: { Authorization: authorization } }
    // );

    // const existingPortals = await getExistingPortalsResponse.json();

    //console.log(JSON.stringify(existingPortals));

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

    for (const portal of refinementManifest.portals) {
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
              altitude: 0,
              gps_timestamp: 0,
              horizontal_accuracy: 0,
              latitude: 0,
              longitude: 0,
              px: portal.averagePose.position.x,
              py: portal.averagePose.position.y,
              pz: portal.averagePose.position.z,
              rx: portal.averagePose.rotation.x,
              ry: portal.averagePose.rotation.y,
              rz: portal.averagePose.rotation.z,
              rw: portal.averagePose.rotation.w,
              scanner_device_id: "none",
              scanner_device_model: "none",
              scanner_device_name: "none",
              vertical_accuracy: 0,
            },
          }),
        }
      );

      if (placeResponse.status !== 200) {
        console.log("error placing portal");
        console.log(placeResponse.status);
        ctx.response.status = placeResponse.status;
        ctx.response.body = {
          message: await placeResponse.text(),
        };
        return;
      }
    }

    let domainMetaData: { [key: string]: any } = {};
    let domainMetadataId: string;
    try {
      const domainmetadataResponse = await fetchDomainDataByNameAndType({
        authorization,
        domainId,
        domainServerUrl,
        dataName: "domain_metadata",
        dataType: "json",
      });

      domainMetaData = JSON.parse(domainmetadataResponse.data);
      domainMetadataId = domainmetadataResponse.metadata.data[0].id;
    } catch (error) {
      domainMetaData = {};
    }

    domainMetaData.canonicalRefinement = refinementId;
    domainMetaData.test = (domainMetaData.test ?? 0) + 1;

    const updateResponse = await updateDomainData({
      authorization,
      domainServerUrl,
      domainId,
      dataId: domainMetadataId!,
      data: JSON.stringify(domainMetaData),
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
