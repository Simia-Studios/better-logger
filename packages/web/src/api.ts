import type {
  ConnectionInfo,
  ConnectionSettings,
  LogGroup,
  QueryRequest,
  QueryResult,
  SavedQuery,
} from "@better-logger/common";

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const headers = new Headers(init?.headers);
  headers.set("content-type", "application/json");
  const response = await fetch(path, {
    ...init,
    headers,
  });
  if (!response.ok) {
    const error = (await response.json()) as { message: string };
    throw new Error(error.message);
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
};

export const api = {
  connection: () => request<ConnectionInfo>("/api/connection"),
  connect: (settings: ConnectionSettings) =>
    request<ConnectionInfo>("/api/connection", {
      method: "PUT",
      body: JSON.stringify(settings),
    }),
  logGroups: (nextToken?: string) =>
    request<{ groups: LogGroup[]; nextToken?: string }>(
      `/api/log-groups${nextToken ? `?nextToken=${encodeURIComponent(nextToken)}` : ""}`,
    ),
  fields: (logGroup: string) =>
    request<{ name: string; coverage: number }[]>(
      `/api/log-groups/${encodeURIComponent(logGroup)}/fields`,
    ),
  savedQueries: () => request<SavedQuery[]>("/api/saved-queries"),
  saveQuery: (query: Omit<SavedQuery, "id" | "updatedAt"> & { id?: string }) =>
    request<{ id: string }>("/api/saved-queries", { method: "POST", body: JSON.stringify(query) }),
  deleteQuery: (id: string) => request<void>(`/api/saved-queries/${id}`, { method: "DELETE" }),
  startQuery: (query: QueryRequest) =>
    request<{ id: string }>("/api/queries", { method: "POST", body: JSON.stringify(query) }),
  query: (id: string) => request<QueryResult>(`/api/queries/${id}`),
  stopQuery: (id: string) => request<void>(`/api/queries/${id}/stop`, { method: "POST" }),
};
