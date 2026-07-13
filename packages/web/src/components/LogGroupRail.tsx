import type { LogGroup } from "@better-logger/common";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Database, Search } from "lucide-react";
import { memo, useDeferredValue, useMemo, useRef, useState, type FC } from "react";
import { roundToDevicePixel } from "../scroll";

type Props = {
  groups: LogGroup[];
  selected: Set<string>;
  loading: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onToggle: (name: string) => void;
  onLoadMore: () => void;
};

const LogGroupRow: FC<{ group: LogGroup; selected: boolean; onToggle: (name: string) => void }> =
  memo((props) => {
    const { group, selected, onToggle } = props;
    return (
      <label className={`group-row${selected ? " selected" : ""}`} title={group.name}>
        <input type="checkbox" checked={selected} onChange={() => onToggle(group.name)} />
        <span className="group-name">{group.name}</span>
        <span className="group-size">{formatBytes(group.storedBytes)}</span>
      </label>
    );
  });

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)}K`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(0)}M`;
  return `${(bytes / 1024 ** 3).toFixed(1)}G`;
};

export const LogGroupRail: FC<Props> = memo((props) => {
  const { groups, selected, loading, hasMore, loadingMore, onToggle, onLoadMore } = props;
  const [filter, setFilter] = useState("");
  const deferredFilter = useDeferredValue(filter.toLowerCase());
  const scrollRef = useRef<HTMLDivElement>(null);
  const visible = useMemo(
    () => groups.filter((group) => group.name.toLowerCase().includes(deferredFilter)),
    [deferredFilter, groups],
  );
  const virtualizer = useVirtualizer({
    count: visible.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 28,
    overscan: 36,
  });

  return (
    <aside className="source-rail" aria-label="CloudWatch log groups">
      <div className="rail-heading">
        <Database size={13} /> LOG GROUPS <span>{groups.length}</span>
      </div>
      <label className="rail-search">
        <Search size={13} />
        <span className="sr-only">Filter log groups</span>
        <input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Filter groups…"
          spellCheck={false}
        />
      </label>
      <div className="group-list" ref={scrollRef}>
        {loading ? <div className="rail-message">Loading CloudWatch…</div> : null}
        <div className="virtual-space" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((item) => {
            const group = visible[item.index];
            if (!group) return null;
            return (
              <div
                className="virtual-row"
                key={group.arn}
                style={{ transform: `translateY(${roundToDevicePixel(item.start)}px)` }}
              >
                <LogGroupRow
                  group={group}
                  selected={selected.has(group.name)}
                  onToggle={onToggle}
                />
              </div>
            );
          })}
        </div>
      </div>
      <div className="rail-footer">
        <span>{selected.size} selected</span>
        {hasMore ? (
          <button type="button" onClick={onLoadMore}>
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        ) : null}
      </div>
    </aside>
  );
});
