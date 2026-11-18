# RetryFlow Dashboard

A small Express application that demonstrates the published [`retryflow-lite`](https://www.npmjs.com/package/retryflow-lite) package against deterministic, simulated upstream requests. It visualizes retries, backoff delays, timeouts, recovery, and operation statistics.

**Live demo:** Not deployed yet. Deployment is intentionally deferred until requested.

**Dashboard screenshot:** Add a screenshot after opening the locally running dashboard.

## Features

- Four repeatable scenarios: success, flaky recovery, permanent failure, and timeout.
- Real retry behavior from the installed `retryflow-lite@1.0.0` npm dependency.
- Per-attempt timeline with failure cause, retry delay, and elapsed time.
- Overview metrics and recent operation history.
- Server-backed configuration panel and a reset action with confirmation.
- Responsive interface with no frontend framework or external API dependency.
- Health endpoint suitable for a hosting platform health check.

## Technologies

- Node.js 18 or newer
- Express 5
- Published `retryflow-lite` npm package
- HTML, CSS, and browser-native JavaScript modules

## Run locally

```bash
npm install
npm start
```

Open <http://localhost:3000>. To use another port, set `PORT` before starting the server, for example `PORT=8080 npm start`.

## Try the scenarios

Use the dashboard buttons or call the API directly:

```bash
curl 'http://localhost:3000/api/demo/run?scenario=flaky'
curl 'http://localhost:3000/api/stats'
curl -X POST 'http://localhost:3000/api/stats/reset'
curl 'http://localhost:3000/api/health'
```

Supported `scenario` values are `success`, `flaky`, `failure`, and `slow`. An unknown or missing scenario returns HTTP 400.

### Example response

```json
{
  "scenario": "flaky",
  "status": "success",
  "totalAttempts": 3,
  "retryCount": 2,
  "retryDelayHistoryMs": [150, 300],
  "result": {
    "message": "The mock service recovered on attempt 3.",
    "source": "controlled-mock-api"
  }
}
```

The API also returns an operation ID, total execution time, per-attempt status and duration, and error details when a run exhausts its retries.

## RetryFlow integration

The server imports `retry` and `RetryError` from the installed `retryflow-lite` dependency. It uses RetryFlow's `onRetry` callback to attach actual calculated delay values to the operation timeline. The active configuration is centralized in `src/config.js` and the dashboard reads those values from `/api/stats`.

The scenarios are controlled local mocks; no third-party API is called. `slow` listens to the signal RetryFlow passes to each attempt, so timed-out mock timers are cleared promptly.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/` | Dashboard |
| `GET` | `/api/demo/run?scenario={success|flaky|failure|slow}` | Execute a RetryFlow scenario |
| `GET` | `/api/stats` | Read counters, configuration, and recent operations |
| `POST` | `/api/stats/reset` | Reset in-memory statistics |
| `GET` | `/api/health` | Health check |

Statistics are stored in memory and reset when the server restarts. Recent activity is capped at 50 operations.

## Tests

```bash
npm test
```

The integration suite starts an ephemeral local server and covers all scenarios, invalid input, statistics, reset behavior, concurrency, static dashboard delivery, and safe error responses.

## Project structure

```text
public/                 Dashboard HTML, CSS, and JavaScript
src/app.js              Express application factory
src/server.js           Production-friendly HTTP entry point
src/config.js            Shared retry configuration
src/routes/              Demo and statistics endpoints
src/services/            Deterministic mock upstream service
src/utils/               Bounded in-memory statistics
test/                    API integration tests
```

## Deployment

The server binds to `0.0.0.0` and uses the platform-provided `PORT` when set. Public deployment has not been performed; it is deferred until requested.

## Troubleshooting

- **Port is already in use:** choose a different `PORT` value.
- **Dependency cannot be installed:** check npm registry access, then run `npm install` again.
- **Timeout scenario takes a few seconds:** it intentionally exhausts four per-attempt timeouts and includes the configured backoff delays.
- **Dashboard data disappeared:** statistics are in-memory and reset after a server restart.
