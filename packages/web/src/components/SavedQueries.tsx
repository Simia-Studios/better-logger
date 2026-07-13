import type { SavedQuery } from "@better-logger/common";
import { Bookmark, Search, Trash2 } from "lucide-react";
import { memo, useDeferredValue, useMemo, useState, type FC } from "react";

type Props = {
  queries: SavedQuery[];
  onOpen: (query: SavedQuery) => void;
  onDelete: (id: string) => void;
};

export const SavedQueries: FC<Props> = memo((props) => {
  const { queries, onOpen, onDelete } = props;
  const [filter, setFilter] = useState("");
  const deferredFilter = useDeferredValue(filter.toLowerCase());
  const visible = useMemo(
    () => queries.filter((query) => query.name.toLowerCase().includes(deferredFilter)),
    [deferredFilter, queries],
  );

  return (
    <section className="saved-panel" aria-label="Saved CloudWatch queries">
      <div className="rail-heading">
        <Bookmark size={13} /> SAVED QUERIES <span>{queries.length}</span>
      </div>
      <label className="rail-search">
        <Search size={13} />
        <span className="sr-only">Filter saved queries</span>
        <input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Filter queries…"
          spellCheck={false}
        />
      </label>
      <div className="saved-list">
        {visible.map((query) => (
          <div className="saved-row" key={query.id}>
            <button
              type="button"
              className="saved-open"
              onClick={() => onOpen(query)}
              title={query.query}
            >
              <span>{query.name}</span>
              <small>
                {query.language} · {query.logGroups.length || "all"} groups
              </small>
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label={`Delete ${query.name}`}
              onClick={() => onDelete(query.id)}
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
        {!visible.length ? <div className="rail-message">No saved queries</div> : null}
      </div>
    </section>
  );
});
