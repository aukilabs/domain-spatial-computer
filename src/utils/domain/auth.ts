import { AukiEnvironmentConfig } from "./config.ts";

export async function GetDDSAccessToken(config: AukiEnvironmentConfig) {
  //read config
  const { API_URL, APP_KEY, APP_SECRET, CLIENT_ID } = config;

  //create auth string
  const authString = `${APP_KEY}:${APP_SECRET}`;
  const authStringBase64 = btoa(authString);

  //construct auth url and headers
  const authUrl = `${API_URL}/service/domains-access-token`;
  const authHeaders = {
    Authorization: `Basic ${authStringBase64}`,
    "posemesh-client-id": CLIENT_ID,
  };

  //get dds access token
  const authResponse = await fetch(authUrl, {
    method: "POST",
    headers: authHeaders,
  });
  if (authResponse.status !== 200) {
    console.log(
      `Error getting domain access token, status code: ${authResponse.status}`
    );
    return "";
  }

  //return dds access token
  return (await authResponse.json()).access_token;
}
