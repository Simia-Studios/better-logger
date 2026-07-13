import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { Play, Save, Square } from "lucide-react";
import { memo, useEffect, useRef, type FC } from "react";
import type { QueryLanguage } from "@better-logger/common";
import { queryExtensions } from "../queryLanguage";

type Props = {
  query: string;
  language: QueryLanguage;
  running: boolean;
  canRun: boolean;
  fields: string[];
  onQueryChange: (query: string) => void;
  onLanguageChange: (language: QueryLanguage) => void;
  onRun: () => void;
  onStop: () => void;
  onSave: () => void;
};

export const QueryEditor: FC<Props> = memo((props) => {
  const {
    query,
    language,
    running,
    canRun,
    fields,
    onQueryChange,
    onLanguageChange,
    onRun,
    onStop,
    onSave,
  } = props;
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView>(undefined);
  const onChangeRef = useRef(onQueryChange);
  const fieldsRef = useRef(fields);
  const initialQueryRef = useRef(query);
  onChangeRef.current = onQueryChange;
  fieldsRef.current = fields;

  useEffect(() => {
    if (!hostRef.current) return;
    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: initialQueryRef.current,
        extensions: queryExtensions(
          (value) => onChangeRef.current(value),
          () => fieldsRef.current,
        ),
      }),
    });
    viewRef.current = view;
    return () => view.destroy();
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || view.state.doc.toString() === query) return;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: query } });
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        if (canRun) onRun();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canRun, onRun]);

  return (
    <section className="query-panel" aria-label="Query editor">
      <div className="panel-toolbar">
        <span className="panel-label">QUERY</span>
        <select
          aria-label="Query language"
          value={language}
          onChange={(event) => onLanguageChange(event.target.value as QueryLanguage)}
        >
          <option value="CWLI">Logs Insights QL</option>
          <option value="PPL">PPL</option>
          <option value="SQL">SQL</option>
        </select>
        <span className="toolbar-spacer" />
        <button
          className="text-button"
          type="button"
          onClick={onSave}
          title="Save query to CloudWatch"
        >
          <Save size={13} /> Save
        </button>
        {running ? (
          <button className="run-button stop" type="button" onClick={onStop}>
            <Square size={12} fill="currentColor" /> Stop
          </button>
        ) : (
          <button
            className="run-button"
            type="button"
            disabled={!canRun}
            onClick={onRun}
            title="Run (Ctrl/⌘ + Enter)"
          >
            <Play size={12} fill="currentColor" /> Run <kbd>⌘↵</kbd>
          </button>
        )}
      </div>
      <div className="editor" ref={hostRef} />
    </section>
  );
});
