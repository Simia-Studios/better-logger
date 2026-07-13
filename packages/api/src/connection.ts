import { DescribeLogGroupsCommand, CloudWatchLogsClient } from "@aws-sdk/client-cloudwatch-logs";
import { GetCallerIdentityCommand, STSClient } from "@aws-sdk/client-sts";
import { fromIni } from "@aws-sdk/credential-provider-ini";
import type { ConnectionInfo, ConnectionSettings } from "@better-logger/common";
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const configPath =
  process.env.BETTER_LOGGER_CONFIG_PATH ?? join(homedir(), ".better-logger", "connection.json");
const awsDirectory = join(homedir(), ".aws");
const defaultSettings: ConnectionSettings = {
  region: process.env.AWS_REGION ?? "us-east-1",
  profile: process.env.AWS_PROFILE,
};

const isSettings = (value: unknown): value is ConnectionSettings => {
  if (typeof value !== "object" || value === null) return false;
  const settings = value as Record<string, unknown>;
  return (
    typeof settings.region === "string" &&
    (settings.profile === undefined || typeof settings.profile === "string")
  );
};

const readSettings = async (): Promise<{ settings: ConnectionSettings; persisted: boolean }> => {
  try {
    const value: unknown = JSON.parse(await readFile(configPath, "utf8"));
    return isSettings(value)
      ? { settings: value, persisted: true }
      : { settings: defaultSettings, persisted: false };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT" || error instanceof SyntaxError)
      return { settings: defaultSettings, persisted: false };
    throw error;
  }
};

export const profileNames = (contents: string) =>
  [...contents.matchAll(/^\[([^\]]+)]/gm)]
    .map((match) => match[1]?.replace(/^profile\s+/, ""))
    .filter((name): name is string => (name ? !name.startsWith("sso-session ") : false));

const readProfiles = async () => {
  const files = [join(awsDirectory, "credentials"), join(awsDirectory, "config")];
  const contents = await Promise.all(
    files.map(async (file) => {
      try {
        return await readFile(file, "utf8");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
        throw error;
      }
    }),
  );
  return [...new Set(contents.flatMap(profileNames))].sort();
};

const createClients = (settings: ConnectionSettings) => {
  const credentials = settings.profile ? fromIni({ profile: settings.profile }) : undefined;
  return {
    logs: new CloudWatchLogsClient({ region: settings.region, credentials }),
    sts: new STSClient({ region: settings.region, credentials }),
  };
};

const loaded = await readSettings();
let settings = loaded.settings;
let persisted = loaded.persisted;
let clients = createClients(settings);

const validate = async (candidate: ConnectionSettings) => {
  const nextClients = createClients(candidate);
  const [identity] = await Promise.all([
    nextClients.sts.send(new GetCallerIdentityCommand({})),
    nextClients.logs.send(new DescribeLogGroupsCommand({ limit: 1 })),
  ]);
  return { accountId: identity.Account, arn: identity.Arn, clients: nextClients };
};

export const persistSettings = async (candidate: ConnectionSettings, path = configPath) => {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await chmod(dirname(path), 0o700);
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(candidate, undefined, 2)}\n`, { mode: 0o600 });
  await rename(temporaryPath, path);
  await chmod(path, 0o600);
};

export const connect = async (candidate: ConnectionSettings): Promise<ConnectionInfo> => {
  const identity = await validate(candidate);
  await persistSettings(candidate);
  settings = candidate;
  persisted = true;
  clients = identity.clients;
  return {
    ...candidate,
    accountId: identity.accountId,
    arn: identity.arn,
    connected: true,
    persisted,
    profiles: await readProfiles(),
  };
};

export const getConnection = async (): Promise<ConnectionInfo> => {
  const profiles = await readProfiles();
  try {
    const identity = await validate(settings);
    clients = identity.clients;
    return {
      ...settings,
      accountId: identity.accountId,
      arn: identity.arn,
      connected: true,
      persisted,
      profiles,
    };
  } catch (error) {
    return {
      ...settings,
      connected: false,
      error: error instanceof Error ? error.message : "Unable to connect to AWS",
      persisted,
      profiles,
    };
  }
};

export const getCloudWatchClient = () => clients.logs;
