type Options = {
  domainServerUrl: string;
  domainId: string;
  dataName: string;
  dataType: string;
  authorization: string;
};

type Metadata = {
  id: string;
  domain_id: string;
  created_at: string;
  updated_at: string;
  link: string;
  name: string;
  data_type: string;
};

export async function fetchDomainDataByNameAndType({
  domainServerUrl,
  domainId,
  dataName,
  dataType,
  authorization,
}: Options) {
  const metadataResponse = await fetch(
    `${domainServerUrl}/api/v1/domains/${domainId}/data?name=${dataName}&data_type=${dataType}`,
    {
      method: "GET",
      headers: {
        Authorization: authorization,
      },
    }
  );

  const metadata = (await metadataResponse.json()) as { data: Metadata[] };

  const fetchResponse = await fetch(
    `${domainServerUrl}/api/v1/domains/${domainId}/data/${metadata.data[0].id}?raw=1`,
    {
      method: "GET",
      headers: {
        accept: "multipart/form-data",
        Authorization: authorization,
      },
    }
  );

  //bail out if we cant get the manifest
  if (fetchResponse.status != 200) {
    console.log(fetchResponse.status);
    console.log(await fetchResponse.text());
    throw new Error();
  }

  const data = await fetchResponse.text();

  return { metadata, data };

  //parse the file from the form data
  //const data = (await fetchResponse.formData()).get(dataName)?.toString();

  //bail out of theres an issue with the form data
  //   if (!data) {
  //     throw new Error();
  //   }
  //   return data;
}
