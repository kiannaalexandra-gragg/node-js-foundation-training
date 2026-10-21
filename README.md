# node-js-foundation-training

[![CI](https://github.com/kiannaalexandra-gragg/node-js-foundation-training/actions/workflows/ci.yml/badge.svg)](https://github.com/kiannaalexandra-gragg/node-js-foundation-training/actions/workflows/ci.yml)

My hands-on builds for the Node.js Developer Training Program, stages M01 to M10.

## How this repo relates to `node-js-training-rnd`

This repo is the **build** side of the program. Its companion,
[`node-js-training-rnd`](https://github.com/kiannaalexandra-gragg/node-js-training-rnd), is the
**content** side.

| Repo | Holds |
| --- | --- |
| `node-js-training-rnd` | Each stage's `brief.md`, `tasks.md` and `write-up-template.md`, plus my `write-up.md` and `training-material.md` |
| `node-js-foundation-training` (this repo) | The code and files I build for each stage, worked from that stage's brief |

A "module" in both repos is a training stage, not a JavaScript module.

## Layout

There are two kinds of folder. Most stages are standalone, so each has its own folder under
`modules/`, named exactly like its folder in `node-js-training-rnd`. The Task API is the exception:
one project that grows across four stages, so it lives in a single top-level `task-api/` folder.

```text
.
├─ .nvmrc                 # Node version for the cohort
├─ .github/workflows/     # ci.yml: install, generate, type-check, test (M09)
├─ modules/
│  └─ mNN-<name>/         # standalone stages: M01-M04 and M06, e.g. m01-dev-environment-git-github
└─ task-api/              # the Task API, M05 to M09, one project that grows
   ├─ src/                # app.ts, server.ts, config.ts, db.ts, errors.ts, middleware/, routes/, services/, ...
   ├─ prisma/             # schema.prisma, migrations/, seed.ts (M07 onward)
   ├─ tests/              # Jest + Supertest integration tests (M09)
   ├─ bruno/              # Bruno collection (plain text)
   ├─ package.json, tsconfig.json
   └─ .env.example, README.md
```

Stage folders are added as each stage is built.

### Why the Task API is not under `modules/`

M05, M07, M08 and M09 do not each build a separate program. They build one Task API, and each stage
changes it: v1 (M05) adds routing and errors on an in-memory store, v2 (M07) adds Prisma, v3 (M08)
adds Zod, and v4 (M09) adds tests. Four folders would mean four copies of the same `package.json`,
lockfile and Bruno collection, and the Prisma migrations could not carry from one version to the
next. So there is one `task-api/`, and **each version is a pull request**: the merge of
`feat/module-05/...` is v1, the merge of the M07 branch is v2, and so on. The content side still has
one folder per stage (`modules/m05-express-task-api-v1/` and so on), because that is where each
stage's write-up and training material live.

| Stage | Where the code is |
| --- | --- |
| M01-M04 | `modules/mNN-<name>/` |
| M05 (Task API v1) | `task-api/` |
| M06 (SQL, no API) | `modules/m06-sql-fundamentals-sqlite/` |
| M07-M09 (Task API v2-v4) | `task-api/`, changed in place |
| M10 (capstone) | its own project, not `task-api/` |

## Working conventions

- Node.js 24 LTS, pinned in `.nvmrc`. Use `nvm use` in the repo root.
- Work happens on a feature branch named `feat/module-NN/<topic>`. Nothing is pushed straight to `main`.
- Commits follow Conventional Commits.
- Real secrets are never committed. Each stage that needs configuration ships an `.env.example`.
