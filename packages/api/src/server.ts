import type { ConnectionSettings, QueryRequest, SavedQuery } from "@better-logger/common";
import express, { type NextFunction, type Request, type Response } from "express";
import {
  deleteQuery,
  getQuery,
  isQueryLanguage,
  listFields,
  listLogGroups,
  listSavedQueries,
  saveQuery,
  startQuery,
  stopQuery,
} from "./cloudwatch.js";
import { connect, getConnection } from "./connection.js";

const app = express();
const port = Number(process.env.PORT ?? 3100);

app.use(express.json({ limit: "32kb" }));

app.get("/api/connection", async (_request, response) => response.json(await getConnection()));

app.put("/api/connection", async (request, response) => {
  const body = request.body as Partial<ConnectionSettings>;
  if (typeof body.region !== "string" || !body.region.trim()) {
    response.status(400).json({ message: "AWS region is required." });
    return;
  }
  response.json(
    await connect({
      region: body.region.trim(),
      profile: typeof body.profile === "string" ? body.profile.trim() || undefined : undefined,
    }),
  );
});

app.get("/api/log-groups", async (request, response) => {
  response.json(
    await listLogGroups(
      typeof request.query.nextToken === "string" ? request.query.nextToken : undefined,
    ),
  );
});

app.get("/api/log-groups/:name/fields", async (request, response) => {
  response.json(
    await listFields(request.params.name, Number(request.query.time ?? Date.now() / 1000)),
  );
});

app.get("/api/saved-queries", async (_request, response) =>
  response.json(await listSavedQueries()),
);

app.post("/api/saved-queries", async (request, response) => {
  const body = request.body as Partial<SavedQuery>;
  if (!body.name || !body.query || !isQueryLanguage(body.language) || !body.logGroups) {
    response.status(400).json({ message: "Name, query, language, and log groups are required." });
    return;
  }
  response.json(
    await saveQuery({
      id: body.id,
      name: body.name,
      query: body.query,
      language: body.language,
      logGroups: body.logGroups,
    }),
  );
});

app.delete("/api/saved-queries/:id", async (request, response) => {
  await deleteQuery(request.params.id);
  response.status(204).end();
});

app.post("/api/queries", async (request, response) => {
  const body = request.body as Partial<QueryRequest>;
  if (!body.query || !isQueryLanguage(body.language) || !body.logGroups?.length) {
    response
      .status(400)
      .json({ message: "Query, language, and at least one log group are required." });
    return;
  }
  response.json(await startQuery(body as QueryRequest));
});

app.get("/api/queries/:id", async (request, response) =>
  response.json(await getQuery(request.params.id)),
);

app.post("/api/queries/:id/stop", async (request, response) => {
  await stopQuery(request.params.id);
  response.status(204).end();
});

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  const message = error instanceof Error ? error.message : "Unexpected CloudWatch error";
  response.status(500).json({ message });
});

app.listen(port, () => {
  process.stdout.write(`better-logger API listening on http://localhost:${port}\n`);
});
