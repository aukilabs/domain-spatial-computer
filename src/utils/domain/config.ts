import { v4 as uuid } from "npm:uuid";

const id = uuid();

export type AukiEnvironmentConfig = {
  API_URL: string;
  DDS_URL: string;
  APP_KEY: string;
  APP_SECRET: string;
  CLIENT_ID: string;
};

//config is set at runtime by environment
export function ReadConfig(): AukiEnvironmentConfig {
  //return config and client id
  return {
    API_URL: Deno.env.get("AUKI_API_URL") || "",
    DDS_URL: Deno.env.get("AUKI_DDS_URL") || "",
    APP_KEY: Deno.env.get("AUKI_APP_KEY") || "",
    APP_SECRET: Deno.env.get("AUKI_APP_SECRET") || "",
    CLIENT_ID: id,
  };
}
