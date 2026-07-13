export type QueryLanguage = "CWLI" | "PPL" | "SQL";

export type ConnectionSettings = {
  region: string;
  profile?: string;
};

export type ConnectionInfo = ConnectionSettings & {
  accountId?: string;
  arn?: string;
  connected: boolean;
  error?: string;
  persisted: boolean;
  profiles: string[];
};

export type LogGroup = {
  arn: string;
  name: string;
  storedBytes: number;
  retentionDays?: number;
};

export type SavedQuery = {
  id: string;
  name: string;
  query: string;
  language: QueryLanguage;
  logGroups: string[];
  updatedAt: number;
};

export type QueryRequest = {
  query: string;
  language: QueryLanguage;
  logGroups: string[];
  startTime: number;
  endTime: number;
  limit: number;
};

export type QueryCell = { field: string; value: string };
export type QueryRow = QueryCell[];

export type QueryProgress = {
  bytesScanned: number;
  recordsMatched: number;
  recordsScanned: number;
};

export type QueryResult = {
  status: "Scheduled" | "Running" | "Complete" | "Failed" | "Cancelled" | "Timeout" | "Unknown";
  rows: QueryRow[];
  progress: QueryProgress;
};
