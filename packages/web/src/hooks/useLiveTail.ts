import type {
  LiveTailEvent,
  LiveTailMessage,
  LiveTailRequest,
  QueryRow,
} from "@better-logger/common";
import { useCallback, useEffect, useRef, useState } from "react";

const maxRows = 20_000;

export const liveEventToRow = (event: LiveTailEvent): QueryRow => [
  { field: "@timestamp", value: new Date(event.timestamp).toISOString() },
  { field: "@message", value: event.message },
  { field: "@logStream", value: event.logStream },
  { field: "@log", value: event.logGroup },
  { field: "@ingestionTime", value: new Date(event.ingestionTime).toISOString() },
];

const parseMessage = (value: string): LiveTailMessage | undefined => {
  try {
    const message: unknown = JSON.parse(value);
    if (typeof message !== "object" || message === null || !("type" in message)) return;
    const type = message.type;
    if (type === "started" || type === "events" || type === "error" || type === "stopped")
      return message as LiveTailMessage;
  } catch {
    return;
  }
};

export const useLiveTail = () => {
  const [rows, setRows] = useState<QueryRow[]>([]);
  const [status, setStatus] = useState<"Idle" | "Connecting" | "Live" | "Stopped" | "Error">(
    "Idle",
  );
  const [error, setError] = useState<string>();
  const [received, setReceived] = useState(0);
  const [sampled, setSampled] = useState(false);
  const [session, setSession] = useState(0);
  const socketRef = useRef<WebSocket>(undefined);
  const pendingRef = useRef<LiveTailEvent[]>([]);
  const frameRef = useRef<number>(undefined);

  const flush = useCallback(() => {
    frameRef.current = undefined;
    const events = pendingRef.current;
    pendingRef.current = [];
    if (!events.length) return;
    setRows((current) => [...current, ...events.map(liveEventToRow)].slice(-maxRows));
    setReceived((current) => current + events.length);
  }, []);

  const queue = useCallback(
    (events: LiveTailEvent[]) => {
      pendingRef.current.push(...events);
      frameRef.current ??= requestAnimationFrame(flush);
    },
    [flush],
  );

  const stop = useCallback(() => {
    const socket = socketRef.current;
    socketRef.current = undefined;
    socket?.close(1000, "Stopped by user");
    setStatus("Stopped");
  }, []);

  const start = useCallback(
    (request: LiveTailRequest) => {
      socketRef.current?.close(1000, "Replaced by new session");
      if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current);
      frameRef.current = undefined;
      pendingRef.current = [];
      setRows([]);
      setSession((current) => current + 1);
      setReceived(0);
      setSampled(false);
      setError(undefined);
      setStatus("Connecting");

      const protocol = location.protocol === "https:" ? "wss:" : "ws:";
      const socket = new WebSocket(`${protocol}//${location.host}/api/live-tail`);
      socketRef.current = socket;
      socket.addEventListener("open", () => socket.send(JSON.stringify(request)));
      socket.addEventListener("message", (event) => {
        if (socketRef.current !== socket) return;
        const message = parseMessage(String(event.data));
        if (!message) return;
        if (message.type === "started") setStatus("Live");
        if (message.type === "events") {
          queue(message.events);
          if (message.sampled) setSampled(true);
        }
        if (message.type === "error") {
          setError(message.message);
          setStatus("Error");
        }
        if (message.type === "stopped") setStatus("Stopped");
      });
      socket.addEventListener("error", () => {
        if (socketRef.current !== socket) return;
        setError("Live Tail WebSocket connection failed");
        setStatus("Error");
      });
      socket.addEventListener("close", (event) => {
        if (socketRef.current !== socket) return;
        socketRef.current = undefined;
        if (event.code !== 1000) {
          setError(event.reason || "Live Tail connection closed unexpectedly");
          setStatus("Error");
        }
      });
    },
    [queue],
  );

  useEffect(
    () => () => {
      socketRef.current?.close(1000, "Page closed");
      if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  return { error, received, rows, sampled, session, start, status, stop };
};
