import type { QueryProgress, QueryRow } from "@better-logger/common";
import { useVirtualizer } from "@tanstack/react-virtual";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type FC } from "react";
import { roundToDevicePixel } from "../scroll";

type Props = {
  rows: QueryRow[];
  status: string;
  progress: QueryProgress;
  error?: string;
  live?: { received: number; sampled: boolean };
};

const preferredFields = ["@timestamp", "level", "@message", "@logStream", "@log"];

const getColumns = (rows: QueryRow[]) => {
  const found = new Set(
    rows.flatMap((row) => row.map((cell) => cell.field)).filter((field) => field !== "@ptr"),
  );
  return [...preferredFields.filter((field) => found.delete(field)), ...found];
};

const getValue = (row: QueryRow, field: string) =>
  row.find((cell) => cell.field === field)?.value ?? "";

const levelClass = (value: string) => {
  const level = value.toLowerCase();
  if (level.includes("error") || level.includes("fatal")) return "level-error";
  if (level.includes("warn")) return "level-warn";
  if (level.includes("debug") || level.includes("trace")) return "level-debug";
  return "";
};

const ResultRow: FC<{ row: QueryRow; columns: string[]; template: string }> = memo((props) => {
  const { row, columns, template } = props;
  const level = getValue(row, "level") || getValue(row, "@message");
  return (
    <div
      className={`result-row ${levelClass(level)}`}
      role="row"
      style={{ gridTemplateColumns: template }}
    >
      {columns.map((field) => (
        <div
          className={`result-cell ${field === "@message" ? "message-cell" : ""}`}
          role="cell"
          title={getValue(row, field)}
          key={field}
        >
          {getValue(row, field)}
        </div>
      ))}
    </div>
  );
});

const formatMetric = (value: number) =>
  new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);

export const ResultsGrid: FC<Props> = memo((props) => {
  const { rows, status, progress, error, live } = props;
  const scrollRef = useRef<HTMLDivElement>(null);
  const followRef = useRef(true);
  const [following, setFollowing] = useState(true);
  const columns = useMemo(() => getColumns(rows), [rows]);
  const template = useMemo(
    () =>
      columns
        .map((field) =>
          field === "@message" ? "minmax(480px, 1fr)" : field === "@timestamp" ? "190px" : "150px",
        )
        .join(" "),
    [columns],
  );
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 25,
    overscan: 40,
  });
  const liveMode = Boolean(live);
  const handleScroll = useCallback(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    const next = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 50;
    followRef.current = next;
    setFollowing((current) => (current === next ? current : next));
  }, []);
  const resume = useCallback(() => {
    followRef.current = true;
    setFollowing(true);
    if (rows.length) virtualizer.scrollToIndex(rows.length - 1, { align: "end" });
  }, [rows.length, virtualizer]);

  useEffect(() => {
    if (!liveMode || !followRef.current || !rows.length) return;
    const frame = requestAnimationFrame(() =>
      virtualizer.scrollToIndex(rows.length - 1, { align: "end" }),
    );
    return () => cancelAnimationFrame(frame);
  }, [liveMode, rows.length, virtualizer]);

  return (
    <section className="results-panel" aria-label="Query results">
      <div className="panel-toolbar result-toolbar">
        <span className="panel-label">RESULTS</span>
        <span className={`status-dot ${status.toLowerCase()}`} />
        <span>{status}</span>
        {live ? (
          <>
            <span className="metric">{formatMetric(live.received)} received</span>
            <span className="metric">{formatMetric(rows.length)} buffered</span>
            {live.sampled ? <span className="metric sampled">SAMPLED BY CLOUDWATCH</span> : null}
            <button className="follow-button" type="button" onClick={resume} disabled={following}>
              {following ? "FOLLOWING" : "RESUME"}
            </button>
          </>
        ) : (
          <>
            <span className="metric">{formatMetric(rows.length)} rows</span>
            <span className="metric">{formatMetric(progress.recordsScanned)} scanned</span>
            <span className="metric">{formatMetric(progress.bytesScanned)} bytes</span>
          </>
        )}
      </div>
      {error ? <div className="result-error">{error}</div> : null}
      {!error && !rows.length ? (
        <div className="empty-results">
          {live
            ? "Waiting for newly ingested CloudWatch events…"
            : "Run a query to inspect CloudWatch logs."}
        </div>
      ) : null}
      {rows.length ? (
        <div
          className="result-scroll"
          ref={scrollRef}
          role="table"
          aria-rowcount={rows.length}
          onScroll={liveMode ? handleScroll : undefined}
        >
          <div className="result-header" role="row" style={{ gridTemplateColumns: template }}>
            {columns.map((field) => (
              <div role="columnheader" key={field}>
                {field}
              </div>
            ))}
          </div>
          <div className="virtual-space" style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((item) => {
              const row = rows[item.index];
              if (!row) return null;
              return (
                <div
                  className="virtual-row"
                  key={item.key}
                  style={{ transform: `translateY(${roundToDevicePixel(item.start)}px)` }}
                >
                  <ResultRow row={row} columns={columns} template={template} />
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
});
