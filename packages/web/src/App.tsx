import type { QueryLanguage, QueryProgress, QueryRow, SavedQuery } from "@better-logger/common";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState, type FC } from "react";
import { api } from "./api";
import { AppHeader, StatusBar } from "./components/AppChrome";
import { ConnectionDialog } from "./components/ConnectionDialog";
import { LogGroupRail } from "./components/LogGroupRail";
import { QueryEditor } from "./components/QueryEditor";
import { ResultsGrid } from "./components/ResultsGrid";
import { SaveDialog } from "./components/SaveDialog";
import { SavedQueries } from "./components/SavedQueries";
import { useAwsConnection } from "./hooks/useAwsConnection";
import { useLiveTail } from "./hooks/useLiveTail";

const defaultQuery = `fields @timestamp, level, @message, @logStream
| sort @timestamp desc
| limit 1000`;
const emptyProgress: QueryProgress = { bytesScanned: 0, recordsMatched: 0, recordsScanned: 0 };
const terminalStatuses = new Set(["Complete", "Failed", "Cancelled", "Timeout", "Unknown"]);
const emptyRows: QueryRow[] = [];
const emptyQueries: SavedQuery[] = [];
const emptyFields: string[] = [];

export const App: FC = () => {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState(defaultQuery);
  const [language, setLanguage] = useState<QueryLanguage>("CWLI");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [range, setRange] = useState(3600);
  const [queryId, setQueryId] = useState<string>();
  const [saveOpen, setSaveOpen] = useState(false);
  const [liveFilter, setLiveFilter] = useState("");
  const [view, setView] = useState<"query" | "live">("query");
  const {
    error: liveError,
    received: liveReceived,
    rows: liveRows,
    sampled: liveSampled,
    session: liveSession,
    start: startLiveTail,
    status: liveStatus,
    stop: stopLiveTail,
  } = useLiveTail();
  const resetWorkspace = useCallback(() => {
    stopLiveTail();
    setSelected(new Set());
    setQueryId(undefined);
  }, [stopLiveTail]);
  const aws = useAwsConnection(resetWorkspace);
  const groupsQuery = useInfiniteQuery({
    queryKey: ["log-groups"],
    queryFn: ({ pageParam }) => api.logGroups(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextToken,
    enabled: aws.connected,
  });
  const { fetchNextPage, refetch: refetchGroups } = groupsQuery;
  const savedQuery = useQuery({
    queryKey: ["saved-queries"],
    queryFn: api.savedQueries,
    enabled: aws.connected,
  });
  const groups = useMemo(
    () => groupsQuery.data?.pages.flatMap((page) => page.groups) ?? [],
    [groupsQuery.data],
  );
  const selectedGroups = useMemo(
    () => groups.filter((group) => selected.has(group.name)),
    [groups, selected],
  );
  const selectedIdentifiers = useMemo(
    () => selectedGroups.map((group) => group.arn),
    [selectedGroups],
  );
  const liveEligible = selectedGroups.every((group) => group.class === "STANDARD");
  const fieldGroup = selected.values().next().value;
  const fieldsQuery = useQuery({
    queryKey: ["fields", fieldGroup],
    queryFn: () => api.fields(fieldGroup ?? ""),
    enabled: Boolean(fieldGroup),
    staleTime: 300_000,
  });
  const discoveredFields = useMemo(
    () => fieldsQuery.data?.map((field) => field.name) ?? emptyFields,
    [fieldsQuery.data],
  );

  const resultQuery = useQuery({
    queryKey: ["query-result", queryId],
    queryFn: () => api.query(queryId ?? ""),
    enabled: Boolean(queryId),
    refetchInterval: (state) =>
      terminalStatuses.has(state.state.data?.status ?? "") ? false : 800,
  });
  const {
    mutate: runQuery,
    isPending: runPending,
    error: runError,
  } = useMutation({
    mutationFn: api.startQuery,
    onSuccess: ({ id }) => setQueryId(id),
  });
  const { mutate: stopQuery } = useMutation({
    mutationFn: api.stopQuery,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["query-result", queryId] }),
  });
  const { mutate: saveQuery, isPending: savePending } = useMutation({
    mutationFn: api.saveQuery,
    onSuccess: () => {
      setSaveOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["saved-queries"] });
    },
  });
  const { mutate: deleteQuery } = useMutation({
    mutationFn: api.deleteQuery,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["saved-queries"] }),
  });

  const result = resultQuery.data;
  const running = runPending || result?.status === "Running" || result?.status === "Scheduled";
  const live = liveStatus === "Connecting" || liveStatus === "Live";

  const toggleGroup = useCallback((name: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const run = useCallback(() => {
    if (live) stopLiveTail();
    setView("query");
    const endTime = Math.floor(Date.now() / 1000);
    runQuery({
      query,
      language,
      logGroups: [...selected],
      startTime: endTime - range,
      endTime,
      limit: 10_000,
    });
  }, [language, live, query, range, runQuery, selected, stopLiveTail]);

  const startLive = useCallback(() => {
    if (running && queryId) stopQuery(queryId);
    setView("live");
    startLiveTail({
      logGroupIdentifiers: selectedIdentifiers,
      filterPattern: liveFilter.trim() || undefined,
    });
  }, [liveFilter, queryId, running, selectedIdentifiers, startLiveTail, stopQuery]);

  const stop = useCallback(() => {
    if (queryId) stopQuery(queryId);
  }, [queryId, stopQuery]);

  const openSaved = useCallback((saved: SavedQuery) => {
    setQuery(saved.query);
    setLanguage(saved.language);
    setSelected(new Set(saved.logGroups));
  }, []);

  const save = useCallback(
    (name: string) => saveQuery({ name, query, language, logGroups: [...selected] }),
    [language, query, saveQuery, selected],
  );
  const closeSave = useCallback(() => setSaveOpen(false), []);
  const openSave = useCallback(() => setSaveOpen(true), []);
  const loadMoreGroups = useCallback(() => void fetchNextPage(), [fetchNextPage]);
  const refreshGroups = useCallback(() => void refetchGroups(), [refetchGroups]);
  const removeSaved = useCallback((id: string) => deleteQuery(id), [deleteQuery]);
  const changeRange = useCallback((nextRange: number) => setRange(nextRange), []);

  const queryError = runError?.message ?? resultQuery.error?.message ?? groupsQuery.error?.message;
  const liveView = view === "live";

  return (
    <main className="app-shell">
      <AppHeader
        connected={aws.connected}
        range={range}
        onRangeChange={changeRange}
        onRefresh={refreshGroups}
        onSettings={aws.show}
      />
      <div className="workspace">
        <div className="left-rail">
          <LogGroupRail
            groups={groups}
            selected={selected}
            loading={groupsQuery.isLoading}
            hasMore={groupsQuery.hasNextPage}
            loadingMore={groupsQuery.isFetchingNextPage}
            onToggle={toggleGroup}
            onLoadMore={loadMoreGroups}
          />
          <SavedQueries
            queries={savedQuery.data ?? emptyQueries}
            onOpen={openSaved}
            onDelete={removeSaved}
          />
        </div>
        <div className="main-column">
          <QueryEditor
            query={query}
            language={language}
            running={running}
            canRun={Boolean(query.trim() && selected.size)}
            canLive={
              selectedIdentifiers.length > 0 &&
              selectedIdentifiers.length <= 10 &&
              liveEligible &&
              !running
            }
            fields={discoveredFields}
            live={live}
            liveFilter={liveFilter}
            onQueryChange={setQuery}
            onLanguageChange={setLanguage}
            onLiveFilterChange={setLiveFilter}
            onLiveStart={startLive}
            onLiveStop={stopLiveTail}
            onRun={run}
            onStop={stop}
            onSave={openSave}
          />
          <ResultsGrid
            key={liveView ? `live:${liveSession}` : "query"}
            rows={liveView ? liveRows : (result?.rows ?? emptyRows)}
            status={liveView ? liveStatus : (result?.status ?? (runPending ? "Scheduled" : "Idle"))}
            progress={liveView ? emptyProgress : (result?.progress ?? emptyProgress)}
            error={liveView ? liveError : queryError}
            live={liveView ? { received: liveReceived, sampled: liveSampled } : undefined}
          />
        </div>
      </div>
      <StatusBar
        connection={aws.connection}
        groupCount={groups.length}
        selectedCount={selected.size}
      />
      <SaveDialog open={saveOpen} saving={savePending} onClose={closeSave} onSave={save} />
      {aws.open ? (
        <ConnectionDialog
          key={`${aws.connection.profile ?? "default"}:${aws.connection.region}`}
          connection={aws.connection}
          connecting={aws.connecting}
          error={aws.error}
          dismissable={aws.connected}
          onClose={aws.close}
          onConnect={aws.connect}
        />
      ) : null}
    </main>
  );
};
