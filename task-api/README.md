# Task API

An Express 5 REST API in TypeScript. It is built up across the program: **v1 (M05)** is an in-memory
API with routing, middleware and one consistent error model. **v2 (M07)** stores tasks in SQLite
through Prisma 7. Later stages change this same project in place: Zod validation (v3, M08),
integration tests (v4, M09).

**Current version: v2.** Tasks live in a SQLite file (`dev.db`), so they survive a restart. The v1
in-memory store is gone.

**"v2" names the project iteration, not the URL.** Every endpoint stays under `/api/v1`, as the M05
brief fixes it, and the later stages (v3 and v4) keep it too. v2 does change the response of
`GET /api/v1/tasks` from an array to `{ data, meta }` and adds fields to a task. That is a breaking change
for any client written against v1, and it is accepted here because this API has no clients besides its own
Bruno collection. A real API with clients would put a change like this under a new URL version.

## Setup

```bash
nvm use                      # Node 24, from the .nvmrc in the repo root
cd task-api
npm install
cp .env.example .env         # the values in the example file are fake; API_KEY and DATABASE_URL are required
npm run db:generate          # builds the Prisma client into src/generated/prisma (git-ignored, so every fresh clone needs this)
npm run db:deploy            # creates dev.db and applies every migration
npm run db:seed              # loads the sample data (24 tasks, 7 tags, 5 users plus the default owner)
npm run dev                  # restarts on change; use npm start for a plain run
```

Run `npm run db:generate` again after every change to `prisma/schema.prisma`: `migrate dev` does not
do it for you. Use `npm run db:reset` to rebuild the database from scratch (it deletes all data),
then `npm run db:seed`, because a reset does not run the seed.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | `tsx watch` on `src/server.ts`, loads `.env` |
| `npm start` | `tsx` on `src/server.ts`, loads `.env` |
| `npm run typecheck` | `tsc --noEmit`, strict |
| `npm run db:generate` | `prisma generate`: builds the typed client from `prisma/schema.prisma` |
| `npm run db:migrate` | `prisma migrate dev`: creates a migration from schema changes and applies it. Development only. Add `-- --name <name>` to name it, or `-- --create-only` to write it without applying it. |
| `npm run db:deploy` | `prisma migrate deploy`: applies the committed migrations, creates none. For CI and production. `prisma` is a dev dependency, so the install step that runs it must not omit dev dependencies (no `--omit=dev`). |
| `npm run db:seed` | `prisma db seed`: runs `prisma/seed.ts`. Safe to run twice. |
| `npm run db:reset` | `prisma migrate reset --force`: drops the database and replays every migration. Deletes all data. Development only. |
| `npm run db:studio` | `prisma studio --url file://./dev.db`: opens Prisma Studio, a browser view of the tables, on http://localhost:5555. Run it from `task-api/`. The URL needs the `://`: Studio reads the protocol as everything before it, so the `file:./dev.db` form in `DATABASE_URL` is rejected with "not supported for the file:./dev.db protocol". |
| `npm run check:errors` | Makes real P2002, P2025 and P2003 errors and prints the status each one comes out as |
| `npm run bruno` | Runs the whole Bruno collection in `bruno/` against `http://localhost:3000`. Start the server first. Run all of it: some `Errors` requests use the `taskId` that `Tasks` request 02 saves, and the `Tasks` requests expect the order they are numbered in. The `apiKey` in `bruno/environments/local.bru` must equal the `API_KEY` in your `.env`, and the collection expects port 3000 (`baseUrl` in the same file), so change both if you change `PORT`. |

## Configuration

Read once at startup in `src/config.ts`. The server refuses to start if a value is invalid. The two
database variables at the end of the table are the exception: `src/db.ts` reads them, and it only checks
that `DATABASE_URL` is set. A path that cannot be opened does not stop the server from starting. The first
request that touches the database fails with a 500.

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `3000` | Port to listen on |
| `NODE_ENV` | `development` | `development`, `production` or `test` |
| `API_KEY` | none, required | The key a client sends in the `X-API-Key` header. The example value is a fake: set your own for anything beyond local use. The server does not check how strong the key is. |
| `CORS_ORIGIN` | `*` | Allowed origins, comma-separated |
| `DATABASE_URL` | none, required | The SQLite file, relative to `task-api/`: `file:./dev.db`. Read by `src/db.ts` (the server stops at startup without it) and by the Prisma CLI through `prisma7.config.ts`. |
| `LOG_QUERIES` | `false` | `true` prints the SQL behind every Prisma call |

## Endpoints

| Method and path | Auth | Success | Notes |
| --- | --- | --- | --- |
| `GET /health` | none | 200 `{"status":"ok"}` | |
| `GET /api/v1/tasks` | key | 200, `{ data, meta }` | Filters, sorting and paging, below |
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
| `priority` | integer 1 to 3 | Optional. 1 is high, 3 is low. Defaults to 2. |
| `dueDate` | ISO 8601 string or `null` | Optional. A date (`2026-12-31`) or a date-time, and the day must exist: `2026-02-30` is a 400, not 2 March. Sent back as a full date-time in UTC. |
| `createdAt`, `updatedAt` | ISO 8601 string | Made by the server. Ignored if a client sends them. |
| `userId` | integer | The owner. Made by the server: every task created through the API belongs to the default owner, `owner@example.com`. Ignored if a client sends it. |

`description` and `dueDate` are `null` in a response when they have no value. A `dueDate` can be cleared
with `PATCH {"dueDate": null}`, but a `description` cannot: `null` is a 400 ("Must be a string"). Fields a client sends
that are not in this table are ignored.

### Listing tasks

`GET /api/v1/tasks` returns `{ "data": [tasks], "meta": { "page", "pageSize", "total", "totalPages" } }`.
`total` counts every task that matches the filters, across all pages.

| Query parameter | Accepted values | Default |
| --- | --- | --- |
| `status` | `todo`, `in_progress`, `done` (case-sensitive) | every status |
| `q` | text: tasks whose title or description contains it, ignoring case for ASCII letters. `%` and `_` in it act as SQL wildcards, so `?q=%25` matches every task. | no search |
| `sortBy` | `createdAt`, `title`, `priority`, `dueDate`, `status` | `createdAt` |
| `order` | `asc`, `desc` | `desc` |
| `page` | a whole number of 1 or more | `1` |
| `pageSize` | a whole number from 1 to 100 | `20` |

- Ties in the sort are broken by `id`, so a task never appears on two pages or on none.
- In SQLite `NULL` sorts first in ascending order, so `?sortBy=dueDate&order=asc` lists tasks with no due
  date before the dated ones.
- `sortBy=title` is case-sensitive (SQLite's default `BINARY` collation): `Zebra` sorts before `apple`,
  although `q` ignores case. `sortBy=status` sorts alphabetically (`done`, `in_progress`, `todo`), not in
  workflow order.
- A page past the end returns `"data": []` with the real `total`.
- **A bad value is never ignored.** An unknown value, an empty value (`?status=`, `?q=`) or a
  parameter given twice returns `400` with `VALIDATION_ERROR`, and `details` lists every bad
  parameter, so a typo in a *value* cannot silently return a different list.
- **Unknown query parameters are ignored**, like unknown body fields. A misspelled *key*
  (`?Status=done`, `?state=done`) is not `status`, so it returns every task.

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
| `VALIDATION_ERROR` | 400 | A field, the `:id`, the body or a list query parameter is invalid |
| `BAD_REQUEST` | 400 | The body is not valid JSON, or a client error Express reports without a code of its own (a malformed `%` escape in the URL, a body that does not decompress) |
| `NOT_FOUND` | 404 | No task with that id (Prisma `P2025`), or no such route. The message for a `P2025` is always `Resource not found`. |
| `PAYLOAD_TOO_LARGE` | 413 | The body is over `express.json`'s 100 kb limit |
| `CLIENT_ERROR` | 4xx other than 400 and 413 | A client error Express reports with another status, such as an unsupported `Content-Encoding` (415). The message is always `Request could not be processed`. |
| `CONFLICT` | 409 | Prisma `P2002` (a unique value already exists) or `P2003` (a foreign key conflicts with the rows that exist). The messages are fixed, never Prisma's own text. No v2 route reaches either one, so `npm run check:errors` produces them. |
| `INTERNAL_ERROR` | 500 | Anything unexpected. The message is always `Internal server error`. |

## Layout

```text
task-api/
├─ src/
│  ├─ app.ts                    builds and exports the app, never calls listen
│  ├─ server.ts                 the only listen, graceful shutdown on SIGTERM and SIGINT
│  ├─ config.ts                 environment, read once, fails fast
│  ├─ errors.ts                 AppError and its subclasses
│  ├─ db.ts                     the one PrismaClient, built with the better-sqlite3 adapter
│  ├─ middleware/               request-id, logger, api-key-auth, not-found, error-handler (also maps Prisma errors)
│  ├─ routes/                   URLs only
│  ├─ handlers/                 the logic behind each URL
│  ├─ services/                 task-service.ts: every database call for tasks
│  ├─ validation/               hand-written request validation (replaced by Zod in M08)
│  ├─ types/                    the Task types, taken from the Prisma schema
│  └─ generated/prisma/         the generated Prisma client (git-ignored, made by npm run db:generate)
├─ prisma/
│  ├─ schema.prisma             the data model
│  ├─ migrations/               one folder per migration, committed
│  └─ seed.ts                   the sample data
├─ scripts/                     check-prisma-errors.ts
├─ bruno/                       the Bruno collection, plain text
├─ prisma7.config.ts            Prisma CLI config: schema path, migrations path, seed command, database URL
├─ .env.example
├─ package.json
└─ tsconfig.json
```

`tests/` and `jest.config.js` are added in M09, when something uses them.

## Migrations

`prisma/migrations/` holds three, in order:

| Migration | What it does |
| --- | --- |
| `init` | Creates `User`, `Task`, `Tag` and the join table for tasks and tags |
| `add_priority_due_date` | Adds `Task.priority` (default 2) and `Task.dueDate` |
| `add_task_owner` | Adds the required `Task.userId`. **Hand-edited**: it first creates the default owner, then fills in `userId` for the tasks that already exist, because Prisma cannot add a required column to rows that have no value for it. |

Never edit a migration that has been applied. To change the schema again, make a new migration.

## Import extensions

Imports use `.ts` extensions (`allowImportingTsExtensions`), as in M04. This is the program's open
decision P2, so it is a choice made in this project, not a program rule.
