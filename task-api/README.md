# Task API

An Express 5 REST API in TypeScript. It is built up across the program: **v1 (M05)** is an in-memory
API with routing, middleware and one consistent error model. Later stages change this same project
in place: Prisma and SQLite (v2, M07), Zod validation (v3, M08), integration tests (v4, M09).

**Current version: v1.** Tasks live in memory, so restarting the server empties them.

## Setup

```bash
nvm use                      # Node 24, from the .nvmrc in the repo root
cd task-api
npm install
cp .env.example .env         # the values in the example file are fake; the API_KEY is required
npm run dev                  # restarts on change; use npm start for a plain run
```

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | `tsx watch` on `src/server.ts`, loads `.env` |
| `npm start` | `tsx` on `src/server.ts`, loads `.env` |
| `npm run typecheck` | `tsc --noEmit`, strict |
| `npm run bruno` | Runs the whole Bruno collection in `bruno/` against `http://localhost:3000`. Start the server first. Run all of it: some `Errors` requests use the `taskId` that `Tasks` request 02 saves, and the `Tasks` requests expect the order they are numbered in. The `apiKey` in `bruno/environments/local.bru` must equal the `API_KEY` in your `.env`, and the collection expects port 3000 (`baseUrl` in the same file), so change both if you change `PORT`. |

## Configuration

Read once at startup in `src/config.ts`. The server refuses to start if a value is invalid.

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `3000` | Port to listen on |
| `NODE_ENV` | `development` | `development`, `production` or `test` |
| `API_KEY` | none, required | The key a client sends in the `X-API-Key` header. The example value is a fake: set your own for anything beyond local use. The server does not check how strong the key is. |
| `CORS_ORIGIN` | `*` | Allowed origins, comma-separated |

## Endpoints

| Method and path | Auth | Success | Notes |
| --- | --- | --- | --- |
| `GET /health` | none | 200 `{"status":"ok"}` | |
| `GET /api/v1/tasks` | key | 200, array of tasks | Optional `?status=` filter, below |
| `POST /api/v1/tasks` | key | 201, the task | `title` required |
| `GET /api/v1/tasks/:id` | key | 200, the task | |
| `PATCH /api/v1/tasks/:id` | key | 200, the updated task | At least one field |
| `DELETE /api/v1/tasks/:id` | key | 204, no body | |

Everything under `/api/v1` needs the header `X-API-Key: <your API_KEY>`. A missing or wrong key is a
401. The check runs before routing and before the request body is read, so an unknown URL under
`/api/v1` without a key is also a 401 and with a key is a 404, and a request without a key never
has its body parsed (malformed JSON without a key is a 401, not a 400).

### The task

| Field | Type | Rules |
| --- | --- | --- |
| `id` | string (UUID) | Made by the server. Ignored if a client sends one. |
| `title` | string | Required on create. Not empty after trimming. |
| `description` | string | Optional. |
| `status` | `"todo"` \| `"in_progress"` \| `"done"` | Optional on create (defaults to `todo`). |

Fields a client sends that are not in this table are ignored.

### The `status` filter

`GET /api/v1/tasks?status=<value>`

- **Accepted values:** `todo`, `in_progress`, `done`. Case-sensitive.
- **No `status`:** every task is returned.
- **A valid `status`:** only tasks with that status.
- **Any other value of `status`** returns `400` with `VALIDATION_ERROR` and
  `details: [{ "path": "status", ... }]`. That covers an unknown value (`?status=bogus`), an empty
  value (`?status=`) and the parameter given twice (`?status=todo&status=done`). An invalid value is
  never ignored, so a typo in the *value* cannot silently return the unfiltered list.
- **Other query parameters are ignored**, like unknown body fields. A misspelled *key*
  (`?Status=done`, `?state=done`) is not `status`, so it returns every task.

Pagination and sorting are not in v1. They arrive in v2 (M07).

## Errors

Every error response that Express produces, from every endpoint, has this shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [{ "path": "title", "message": "Required" }],
    "requestId": "9b2f4c1e-6a0d-4e55-8d3b-0c7a1f2e8a10"
  }
}
```

`details` is present only on `VALIDATION_ERROR`. `requestId` is also sent in the `X-Request-Id`
header. A response never contains a stack trace or the text of an unexpected error. The one
exception is a request Node rejects before Express runs, such as a malformed header line or oversized
headers: Node answers those itself with a bare `400` and no JSON body.

| `code` | Status | When |
| --- | --- | --- |
| `UNAUTHORIZED` | 401 | `X-API-Key` missing or wrong |
| `VALIDATION_ERROR` | 400 | A field, the `:id`, the body or the `status` filter is invalid |
| `BAD_REQUEST` | 400 | The body is not valid JSON, or a client error Express reports without a code of its own (a malformed `%` escape in the URL, a body that does not decompress) |
| `NOT_FOUND` | 404 | No task with that id, or no such route |
| `PAYLOAD_TOO_LARGE` | 413 | The body is over `express.json`'s 100 kb limit |
| `CLIENT_ERROR` | 4xx other than 400 and 413 | A client error Express reports with another status, such as an unsupported `Content-Encoding` (415). The message is always `Request could not be processed`. |
| `CONFLICT` | 409 | Defined for the hierarchy. No v1 rule produces it. |
| `INTERNAL_ERROR` | 500 | Anything unexpected. The message is always `Internal server error`. |

## Layout

```text
task-api/
├─ src/
│  ├─ app.ts                    builds and exports the app, never calls listen
│  ├─ server.ts                 the only listen, graceful shutdown on SIGTERM and SIGINT
│  ├─ config.ts                 environment, read once, fails fast
│  ├─ errors.ts                 AppError and its subclasses
│  ├─ middleware/               request-id, logger, api-key-auth, not-found, error-handler
│  ├─ routes/                   URLs only
│  ├─ handlers/                 the logic behind each URL
│  ├─ validation/               hand-written request validation (replaced by Zod in M08)
│  ├─ store/                    the in-memory task store (replaced by Prisma in M07)
│  └─ types/                    the Task types
├─ bruno/                       the Bruno collection, plain text
├─ .env.example
├─ package.json
└─ tsconfig.json
```

`prisma/`, `tests/` and `jest.config.js` are added in M07 and M09, when something uses them.

## Import extensions

Imports use `.ts` extensions (`allowImportingTsExtensions`), as in M04. This is the program's open
decision P2, so it is a choice made in this project, not a program rule.
