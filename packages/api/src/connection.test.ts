import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { persistSettings, profileNames } from "./connection.js";

describe("AWS profile discovery", () => {
  it("combines credentials and config section formats without SSO session metadata", () => {
    expect(
      profileNames(`[default]
[production]
[profile staging]
[sso-session company]
`),
    ).toEqual(["default", "production", "staging"]);
  });

  it("persists only connection metadata with private disk permissions", async () => {
    const directory = await mkdtemp(join(tmpdir(), "better-logger-"));
    const path = join(directory, "nested", "connection.json");

    await persistSettings({ region: "eu-west-1", profile: "production" }, path);

    expect(JSON.parse(await readFile(path, "utf8"))).toEqual({
      region: "eu-west-1",
      profile: "production",
    });
    expect((await stat(path)).mode & 0o777).toBe(0o600);
    expect((await stat(join(directory, "nested"))).mode & 0o777).toBe(0o700);
  });
});
