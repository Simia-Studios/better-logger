# Better Logger

A dense, keyboard-first CloudWatch Logs Insights client. Better Logger keeps CloudWatch Logs as the only backend: log groups, query execution, query results, and saved query definitions all use the CloudWatch Logs API.

## Development

Requirements: Node.js 22+, pnpm 10+, and AWS credentials available through the standard AWS SDK credential chain.

```sh
pnpm install
AWS_REGION=us-east-1 pnpm dev
```

The web client starts on `http://localhost:3000` (or the next available port) and proxies `/api` to the API server on port `3100`. Set `PORT` to override the API port and update the Vite proxy when doing so.

The AWS principal needs these permissions:

- `logs:DescribeLogGroups`
- `logs:GetLogGroupFields`
- `logs:StartQuery`
- `logs:GetQueryResults`
- `logs:StopQuery`
- `logs:StartLiveTail`
- `logs:DescribeQueryDefinitions`
- `logs:PutQueryDefinition`
- `logs:DeleteQueryDefinition`

Run the full Jedz-style validation gate with:

```sh
pnpm check
```

## Architecture

- `packages/web`: React/Vite interface with CodeMirror query assistance and TanStack virtualization/querying.
- `packages/api`: small Node API boundary around AWS SDK v3; credentials never enter the browser.
- `packages/common`: shared request/result contracts.

The API uses the default AWS credential provider chain and `AWS_REGION` (defaulting to `us-east-1`). Saved queries are native CloudWatch Logs query definitions, so they remain visible in the AWS console and to other tools.

## Live streaming

Select one to ten Standard-class log groups and choose **Live tail** to open a real CloudWatch Logs `StartLiveTail` event stream. The API relays AWS event batches over an uncompressed WebSocket at `/api/live-tail`; closing the browser stream aborts the AWS session. The browser retains the newest 20,000 events and keeps following the tail until you scroll upward. Live Tail is billed by AWS per session-minute and CloudWatch samples the stream when more than 500 matching events arrive in one second.

## Connection persistence

The connection screen discovers profiles from `~/.aws/config` and `~/.aws/credentials`, then validates the selected profile with STS and CloudWatch before switching. The selected profile name and region are written atomically to `~/.better-logger/connection.json` with `0600` permissions; AWS keys and tokens are never copied into Better Logger storage. Set `BETTER_LOGGER_CONFIG_PATH` to override the metadata file location.
