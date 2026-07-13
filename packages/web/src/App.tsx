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
  const resetWorkspace = useCallback(() => {
    setSelected(new Set());
    setQueryId(undefined);
  }, []);
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

  const toggleGroup = useCallback((name: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const run = useCallback(() => {
    const endTime = Math.floor(Date.now() / 1000);
    runQuery({
      query,
      language,
      logGroups: [...selected],
      startTime: endTime - range,
      endTime,
      limit: 10_000,
    });
  }, [language, query, range, runQuery, selected]);

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

  const result = resultQuery.data;
  const running = runPending || result?.status === "Running" || result?.status === "Scheduled";
  const error = runError?.message ?? resultQuery.error?.message ?? groupsQuery.error?.message;

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
            fields={discoveredFields}
            onQueryChange={setQuery}
            onLanguageChange={setLanguage}
            onRun={run}
            onStop={stop}
            onSave={openSave}
          />
          <ResultsGrid
            rows={result?.rows ?? emptyRows}
            status={result?.status ?? (runPending ? "Scheduled" : "Idle")}
            progress={result?.progress ?? emptyProgress}
            error={error}
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
