import {
  StartLiveTailCommand,
  type LiveTailSessionLogEvent,
} from "@aws-sdk/client-cloudwatch-logs";
import type { LiveTailEvent, LiveTailMessage, LiveTailRequest } from "@better-logger/common";
import type { Server } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { getCloudWatchClient } from "./connection.js";

const maxBufferedBytes = 2 * 1024 * 1024;

export const parseLiveTailRequest = (value: unknown): LiveTailRequest | undefined => {
  if (typeof value !== "object" || value === null) return;
  const request = value as Record<string, unknown>;
  if (!Array.isArray(request.logGroupIdentifiers)) return;
  if (
    request.logGroupIdentifiers.length < 1 ||
    request.logGroupIdentifiers.length > 10 ||
    !request.logGroupIdentifiers.every(
      (identifier) =>
        typeof identifier === "string" &&
        identifier.startsWith("arn:") &&
        !identifier.endsWith(":*"),
    )
  )
    return;
  if (
    request.filterPattern !== undefined &&
    (typeof request.filterPattern !== "string" || request.filterPattern.length > 2000)
  )
    return;
  return {
    logGroupIdentifiers: request.logGroupIdentifiers,
    filterPattern: request.filterPattern,
  };
};

export const mapLiveTailEvents = (events: LiveTailSessionLogEvent[]): LiveTailEvent[] =>
  events.map((event) => ({
    ingestionTime: event.ingestionTime ?? 0,
    logGroup: event.logGroupIdentifier ?? "",
    logStream: event.logStreamName ?? "",
    message: event.message ?? "",
    timestamp: event.timestamp ?? 0,
  }));

const send = (socket: WebSocket, message: LiveTailMessage) => {
  if (socket.readyState !== WebSocket.OPEN) return;
  if (socket.bufferedAmount > maxBufferedBytes) {
    socket.close(1013, "Client is consuming live logs too slowly");
    return;
  }
  socket.send(JSON.stringify(message));
};

const stream = async (socket: WebSocket, request: LiveTailRequest, signal: AbortSignal) => {
  const response = await getCloudWatchClient().send(
    new StartLiveTailCommand({
      logGroupIdentifiers: request.logGroupIdentifiers,
      logEventFilterPattern: request.filterPattern || undefined,
    }),
    { abortSignal: signal },
  );
  if (!response.responseStream) throw new Error("CloudWatch returned no Live Tail stream");

  for await (const event of response.responseStream) {
    if (event.sessionStart) {
      send(socket, { type: "started", sessionId: event.sessionStart.sessionId ?? "" });
    } else if (event.sessionUpdate) {
      send(socket, {
        type: "events",
        events: mapLiveTailEvents(event.sessionUpdate.sessionResults ?? []),
        sampled: event.sessionUpdate.sessionMetadata?.sampled ?? false,
      });
    } else if (event.SessionTimeoutException) {
      throw new Error(event.SessionTimeoutException.message ?? "Live Tail session timed out");
    } else if (event.SessionStreamingException) {
      throw new Error(event.SessionStreamingException.message ?? "CloudWatch Live Tail failed");
    }
  }
};

const handleConnection = (socket: WebSocket) => {
  const controller = new AbortController();
  const requestTimeout = setTimeout(
    () => socket.close(1008, "Live Tail request not received"),
    10_000,
  );
  socket.once("message", async (data) => {
    clearTimeout(requestTimeout);
    try {
      const text = Array.isArray(data)
        ? Buffer.concat(data).toString("utf8")
        : data instanceof ArrayBuffer
          ? Buffer.from(data).toString("utf8")
          : data.toString("utf8");
      const request = parseLiveTailRequest(JSON.parse(text));
      if (!request) {
        socket.close(1008, "Invalid Live Tail request");
        return;
      }
      await stream(socket, request, controller.signal);
      send(socket, { type: "stopped" });
      socket.close(1000);
    } catch (error) {
      if (controller.signal.aborted) return;
      send(socket, {
        type: "error",
        message: error instanceof Error ? error.message : "CloudWatch Live Tail failed",
      });
      socket.close(1011);
    }
  });
  socket.once("close", () => {
    clearTimeout(requestTimeout);
    controller.abort();
  });
};

export const attachLiveTail = (server: Server) => {
  const webSockets = new WebSocketServer({
    noServer: true,
    perMessageDeflate: false,
    maxPayload: 32_768,
  });
  webSockets.on("connection", handleConnection);
  server.on("upgrade", (request, socket, head) => {
    if (request.url !== "/api/live-tail") {
      socket.destroy();
      return;
    }
    webSockets.handleUpgrade(request, socket, head, (webSocket) => {
      webSockets.emit("connection", webSocket, request);
    });
  });
};
