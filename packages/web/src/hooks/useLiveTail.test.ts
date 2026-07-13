import { describe, expect, it } from "vitest";
import { liveEventToRow } from "./useLiveTail";

describe("Live Tail row normalization", () => {
  it("maps streamed events into the same columns as Insights results", () => {
    expect(
      liveEventToRow({
        timestamp: 1_700_000_000_000,
        ingestionTime: 1_700_000_000_100,
        message: "request complete",
        logGroup: "/aws/lambda/api",
        logStream: "stream-1",
      }),
    ).toEqual([
      { field: "@timestamp", value: "2023-11-14T22:13:20.000Z" },
      { field: "@message", value: "request complete" },
      { field: "@logStream", value: "stream-1" },
      { field: "@log", value: "/aws/lambda/api" },
      { field: "@ingestionTime", value: "2023-11-14T22:13:20.100Z" },
    ]);
  });
});
