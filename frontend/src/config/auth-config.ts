import configData from "../../../config.json";

interface Config {
  databaseUrl?: string;
  oauth?: {
    clientId: string;
    clientSecret: string;
  };
}

const config = configData as Config;

export const AUTH_CONFIG = {
  clientId: config.oauth?.clientId || "",
  clientSecret: config.oauth?.clientSecret || "",
};
