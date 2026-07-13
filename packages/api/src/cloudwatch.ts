import {
  DeleteQueryDefinitionCommand,
  DescribeLogGroupsCommand,
  DescribeQueryDefinitionsCommand,
  GetLogGroupFieldsCommand,
  GetQueryResultsCommand,
  PutQueryDefinitionCommand,
  StartQueryCommand,
  StopQueryCommand,
  type QueryDefinition,
  type ResultField,
} from "@aws-sdk/client-cloudwatch-logs";
import type {
  LogGroup,
  QueryLanguage,
  QueryRequest,
  QueryResult,
  QueryRow,
  SavedQuery,
} from "@better-logger/common";
import { getCloudWatchClient } from "./connection.js";

export const mapSavedQuery = (query: QueryDefinition): SavedQuery => ({
  id: query.queryDefinitionId ?? "",
  name: query.name ?? "Untitled query",
  query: query.queryString ?? "",
  language: query.queryLanguage ?? "CWLI",
  logGroups: query.logGroupNames ?? [],
  updatedAt: query.lastModified ?? 0,
});

export const mapRow = (row: ResultField[]): QueryRow =>
  row.flatMap((cell) =>
    cell.field && cell.value !== undefined ? [{ field: cell.field, value: cell.value }] : [],
  );

export const listLogGroups = async (nextToken?: string) => {
  const output = await getCloudWatchClient().send(
    new DescribeLogGroupsCommand({ limit: 50, nextToken }),
  );
  const groups: LogGroup[] = (output.logGroups ?? []).flatMap((group) =>
    group.logGroupName && group.arn
      ? [
          {
            arn: group.arn,
            name: group.logGroupName,
            storedBytes: group.storedBytes ?? 0,
            retentionDays: group.retentionInDays,
          },
        ]
      : [],
  );
  return { groups, nextToken: output.nextToken };
};

const listSavedQueryPage = async (
  nextToken?: string,
  previous: SavedQuery[] = [],
): Promise<SavedQuery[]> => {
  const output = await getCloudWatchClient().send(
    new DescribeQueryDefinitionsCommand({ maxResults: 1000, nextToken }),
  );
  const queries = [...previous, ...(output.queryDefinitions ?? []).map(mapSavedQuery)];
  return output.nextToken ? listSavedQueryPage(output.nextToken, queries) : queries;
};

export const listSavedQueries = async (): Promise<SavedQuery[]> => listSavedQueryPage();

export const saveQuery = async (query: Omit<SavedQuery, "id" | "updatedAt"> & { id?: string }) => {
  const output = await getCloudWatchClient().send(
    new PutQueryDefinitionCommand({
      name: query.name,
      queryString: query.query,
      queryLanguage: query.language,
      logGroupNames: query.logGroups,
      queryDefinitionId: query.id || undefined,
    }),
  );
  return { id: output.queryDefinitionId ?? query.id ?? "" };
};

export const deleteQuery = async (id: string) => {
  await getCloudWatchClient().send(new DeleteQueryDefinitionCommand({ queryDefinitionId: id }));
};

export const startQuery = async (request: QueryRequest) => {
  const output = await getCloudWatchClient().send(
    new StartQueryCommand({
      queryString: request.query,
      queryLanguage: request.language,
      logGroupNames: request.logGroups,
      startTime: request.startTime,
      endTime: request.endTime,
      limit: request.limit,
    }),
  );
  return { id: output.queryId ?? "" };
};

export const getQuery = async (id: string): Promise<QueryResult> => {
  const output = await getCloudWatchClient().send(new GetQueryResultsCommand({ queryId: id }));
  return {
    status: output.status ?? "Unknown",
    rows: (output.results ?? []).map(mapRow),
    progress: {
      bytesScanned: output.statistics?.bytesScanned ?? 0,
      recordsMatched: output.statistics?.recordsMatched ?? 0,
      recordsScanned: output.statistics?.recordsScanned ?? 0,
    },
  };
};

export const stopQuery = async (id: string) => {
  await getCloudWatchClient().send(new StopQueryCommand({ queryId: id }));
};

export const listFields = async (logGroupName: string, time: number) => {
  const output = await getCloudWatchClient().send(
    new GetLogGroupFieldsCommand({ logGroupName, time }),
  );
  return (output.logGroupFields ?? []).flatMap((field) =>
    field.name ? [{ name: field.name, coverage: field.percent ?? 0 }] : [],
  );
};

export const isQueryLanguage = (value: unknown): value is QueryLanguage =>
  value === "CWLI" || value === "PPL" || value === "SQL";
