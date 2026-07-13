import { describe, expect, it } from "vitest";
import { mapLiveTailEvents, parseLiveTailRequest } from "./liveTail.js";

describe("CloudWatch Live Tail boundary", () => {
  it("accepts non-wildcard log group ARNs and an optional filter", () => {
    expect(
      parseLiveTailRequest({
        logGroupIdentifiers: ["arn:aws:logs:us-east-1:123456789012:log-group:/aws/lambda/api"],
        filterPattern: "ERROR",
      }),
    ).toEqual({
      logGroupIdentifiers: ["arn:aws:logs:us-east-1:123456789012:log-group:/aws/lambda/api"],
      filterPattern: "ERROR",
    });
  });

  it("rejects IAM wildcard ARNs and more than ten groups", () => {
    expect(
      parseLiveTailRequest({
        logGroupIdentifiers: ["arn:aws:logs:us-east-1:123456789012:log-group:api:*"],
      }),
    ).toBeUndefined();
    expect(
      parseLiveTailRequest({
        logGroupIdentifiers: Array.from(
          { length: 11 },
          (_, index) => `arn:aws:logs:us-east-1:123456789012:log-group:group-${index}`,
        ),
      }),
    ).toBeUndefined();
  });

  it("normalizes streamed AWS events before crossing the WebSocket", () => {
    expect(
      mapLiveTailEvents([
        {
          timestamp: 1_700_000_000_000,
          ingestionTime: 1_700_000_000_100,
          message: "request complete",
          logGroupIdentifier: "/aws/lambda/api",
          logStreamName: "2026/07/13/[$LATEST]abc",
        },
      ]),
    ).toEqual([
      {
        timestamp: 1_700_000_000_000,
        ingestionTime: 1_700_000_000_100,
        message: "request complete",
        logGroup: "/aws/lambda/api",
        logStream: "2026/07/13/[$LATEST]abc",
      },
    ]);
  });
});
