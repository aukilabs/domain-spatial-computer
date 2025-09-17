import { GetDDSAccessToken } from "./auth.ts";
import { ReadConfig } from "./config.ts";

export async function EnterDomain(domainId: string) {
  const config = ReadConfig();
  const { DDS_URL, CLIENT_ID } = config;
  const ddsAccessToken = await GetDDSAccessToken(config);
  const response = await fetch(`${DDS_URL}/api/v1/domains/${domainId}/auth`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ddsAccessToken}`,
      "posemesh-client-id": CLIENT_ID,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const responseBody = await response.json();
  const { access_token, domain_server } = responseBody;
  return {
    authorization: `Bearer ${access_token}`,
    domainServerUrl: domain_server.url as string,
  };
}
