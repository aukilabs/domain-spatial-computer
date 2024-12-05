type Options = {
  domainServerUrl: string;
  domainId: string;
  authorization: string;
  dataId: string;
  data: string;
};

export async function updateDomainData({
  domainServerUrl,
  domainId,
  dataId,
  data,
  authorization,
}: Options) {
  const body = new FormData();
  body.append(dataId, data);
  const uploadResponse = await fetch(
    `${domainServerUrl}/api/v1/domains/${domainId}/data`,
    {
      method: "PUT",
      headers: {
        Authorization: authorization,
      },
      body,
    }
  );

  return uploadResponse;
}
