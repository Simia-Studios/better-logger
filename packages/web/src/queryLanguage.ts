import { autocompletion, type CompletionContext } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import {
  HighlightStyle,
  StreamLanguage,
  syntaxHighlighting,
  type StreamParser,
} from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { tags } from "@lezer/highlight";

const commands = [
  ["fields", "Select fields to display, e.g. fields @timestamp, @message"],
  ["filter", "Keep records matching an expression"],
  ["filterIndex", "Use a field index to reduce scanned volume"],
  ["parse", "Extract fields using glob or regular expressions"],
  ["stats", "Calculate aggregations grouped by fields or time bins"],
  ["sort", "Sort results using asc or desc"],
  ["limit", "Limit the number of returned records"],
  ["dedup", "Remove duplicate records based on fields"],
  ["display", "Choose fields to display"],
  ["pattern", "Group log data into recurring patterns"],
  ["diff", "Compare the current range with a previous range"],
  ["anomaly", "Identify unusual patterns in log data"],
  ["unnest", "Flatten a list into multiple records"],
] as const;

const functions = [
  "bin",
  "count",
  "count_distinct",
  "sum",
  "avg",
  "min",
  "max",
  "isblank",
  "ispresent",
  "strlen",
  "tolower",
  "toupper",
  "coalesce",
];
const fields = [
  "@timestamp",
  "@message",
  "@log",
  "@logStream",
  "@ptr",
  "@ingestionTime",
  "level",
  "service",
  "requestId",
  "traceId",
];

const words = new Set<string>(commands.map(([label]) => label));
const builtins = new Set<string>(functions);

const parser: StreamParser<undefined> = {
  startState: () => undefined,
  token: (stream) => {
    if (stream.match(/^#[^\n]*/)) return "comment";
    if (stream.match(/^"(?:[^"\\]|\\.)*"/)) return "string";
    if (stream.match(/^\/(?:[^/\\]|\\.)+\/[gimsuy]*/)) return "regexp";
    if (stream.match(/^\d+(?:\.\d+)?/)) return "number";
    if (stream.match(/^[|(),=*<>!+-]+/)) return "operator";
    if (stream.match(/^[@A-Za-z_][\w.@-]*/)) {
      const value = stream.current();
      if (words.has(value)) return "keyword";
      if (builtins.has(value)) return "variableName.function";
      if (value.startsWith("@")) return "variableName.special";
      return "variableName";
    }
    stream.next();
    return null;
  },
};

const complete = (context: CompletionContext, discoveredFields: string[]) => {
  const word = context.matchBefore(/[\w@.]*/);
  if (!word || (word.from === word.to && !context.explicit)) return null;
  return {
    from: word.from,
    options: [
      ...commands.map(([label, info]) => ({ label, type: "keyword", info })),
      ...functions.map((label) => ({ label, type: "function", detail: "function" })),
      ...[...new Set([...fields, ...discoveredFields])].map((label) => ({
        label,
        type: "variable",
        detail: "CloudWatch field",
      })),
    ],
  };
};

const highlight = HighlightStyle.define([
  { tag: tags.keyword, color: "#f0f0f0" },
  { tag: tags.string, color: "#cccccc" },
  { tag: tags.number, color: "#b8b8b8" },
  { tag: tags.comment, color: "#666666", fontStyle: "italic" },
  { tag: tags.regexp, color: "#c4c4c4" },
  { tag: tags.operator, color: "#a8a8a8" },
  { tag: tags.function(tags.variableName), color: "#dddddd" },
  { tag: tags.special(tags.variableName), color: "#bcbcbc" },
]);

export const queryExtensions = (onChange: (value: string) => void, getFields: () => string[]) => [
  lineNumbers(),
  history(),
  EditorView.lineWrapping,
  StreamLanguage.define(parser),
  syntaxHighlighting(highlight),
  autocompletion({
    override: [(context) => complete(context, getFields())],
    activateOnTyping: true,
  }),
  keymap.of([...defaultKeymap, ...historyKeymap]),
  EditorState.tabSize.of(2),
  EditorView.updateListener.of((update) => {
    if (update.docChanged) onChange(update.state.doc.toString());
  }),
  EditorView.theme({
    "&": { height: "100%", background: "transparent", fontSize: "13px" },
    ".cm-scroller": { fontFamily: "var(--mono)", lineHeight: "20px", overflow: "auto" },
    ".cm-content": { padding: "7px 12px", caretColor: "#ffffff" },
    ".cm-gutters": { background: "#0c0c0c", color: "#555555", border: "none" },
    ".cm-lineNumbers .cm-gutterElement": { padding: "0 10px 0 8px", minWidth: "32px" },
    ".cm-activeLine, .cm-activeLineGutter": { background: "#ffffff08" },
    ".cm-selectionBackground, ::selection": { background: "#383838 !important" },
    ".cm-tooltip": { background: "#151515", border: "1px solid #383838", color: "#dddddd" },
    ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
      background: "#303030",
      color: "#ffffff",
    },
    ".cm-completionDetail": { color: "#777777", fontStyle: "normal" },
  }),
];
