# node-js-foundation-training

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

Each stage has a folder under `modules/`, named exactly like its folder in `node-js-training-rnd`.

```text
.
├─ .nvmrc                 # Node version for the cohort
└─ modules/
   └─ mNN-<name>/         # one folder per stage, e.g. m01-dev-environment-git-github
```

Stage folders are added as each stage is built.

## Working conventions

- Node.js 24 LTS, pinned in `.nvmrc`. Use `nvm use` in the repo root.
- Work happens on a feature branch named `feat/module-NN/<topic>`. Nothing is pushed straight to `main`.
- Commits follow Conventional Commits.
- Real secrets are never committed. Each stage that needs configuration ships an `.env.example`.
