import { describe, expect, it } from "vitest";
import { mapRow, mapSavedQuery } from "./cloudwatch.js";

describe("CloudWatch response normalization", () => {
  it("keeps named result cells at the API boundary", () => {
    expect(
      mapRow([
        { field: "@timestamp", value: "2026-07-13T02:00:00Z" },
        { field: "@message", value: "request complete" },
        { value: "ignored" },
      ]),
    ).toEqual([
      { field: "@timestamp", value: "2026-07-13T02:00:00Z" },
      { field: "@message", value: "request complete" },
    ]);
  });

  it("maps native query definitions into the shared saved-query contract", () => {
    expect(
      mapSavedQuery({
        queryDefinitionId: "query-1",
        name: "Recent errors",
        queryString: "filter level = 'error'",
        queryLanguage: "CWLI",
        logGroupNames: ["/aws/lambda/api"],
        lastModified: 1_789_000_000,
      }),
    ).toEqual({
      id: "query-1",
      name: "Recent errors",
      query: "filter level = 'error'",
      language: "CWLI",
      logGroups: ["/aws/lambda/api"],
      updatedAt: 1_789_000_000,
    });
  });
});
