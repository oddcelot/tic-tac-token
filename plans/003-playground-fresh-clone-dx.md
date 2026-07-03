# Plan 003: Make the token playground run from a fresh clone (and be deployable)

> **⚠️ RECONCILIATION BANNER (2026-07-03)** — Plan 001 renamed the **root package** from `dtcg-tokens` to `@oddsquad/tic-tac-token`. This plan was written before that rename. Substitute throughout wherever the **root validator package** is meant:
> - `app/token-playground/package.json` dependency key is now `"@oddsquad/tic-tac-token": "workspace:*"` (not `"dtcg-tokens"`).
> - `pnpm -F dtcg-tokens build:dist` → `pnpm -F @oddsquad/tic-tac-token build:dist`. Any aggregate `build:packages` script must use the new name.
> - Every `dtcg-tokens-lsp` reference is a **different** package and is UNCHANGED.
>
> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 221fdf6..HEAD -- app/token-playground package.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (independent of 001/002 — uses workspace-local builds, not npm)
- **Category**: dx
- **Planned at**: commit `221fdf6`, 2026-07-03

## Why this matters

The playground (`app/token-playground`) is the repo's showcase — a Solid + Vite + Monaco SPA with live DTCG validation and the actual language server running in-page via a Web Worker. It is also the surface the last ~10 commits invested in. But a fresh clone cannot run it: the worker imports `dtcg-tokens-lsp/browser`, which maps to `lsp/dist/server-browser.js`, and nothing ever builds `lsp/dist/` (the lsp package's default `build` script is typecheck-only). The flagship feature silently breaks on `pnpm dev`. One script-wiring change makes the demo reproducible, and the build output is already fully static and deployable.

## Current state

- `app/token-playground/src/lsp/worker.ts:5` — the load-bearing import:

  ```ts
  import "dtcg-tokens-lsp/browser";
  ```

  `lsp/package.json` maps `./browser` → `./dist/server-browser.js`. `lsp/dist/` does not exist in a fresh checkout, and no script builds it automatically.
- `app/token-playground/package.json` (verbatim, relevant parts):

  ```jsonc
  {
    "name": "vite-template-solid",     // leftover template name
    "version": "0.0.0",
    "scripts": {
      "start": "vite",
      "dev": "vite",
      "build": "vite build",
      "serve": "vite preview"
    },
    "dependencies": {
      "dtcg-tokens": "workspace:*",
      "dtcg-tokens-lsp": "workspace:*",
      // …monaco-editor, solid-js, vscode-jsonrpc, vscode-languageserver-protocol
    }
  }
  ```

  Note: no `"private": true` — with plans 001/002 publishing sibling packages, an accidental `pnpm publish -r` could publish this template-named app.
- `dtcg-tokens` (the other workspace dep) also resolves to built output — root `package.json` `main`/`exports` point at `./dist/index.js`, and root `dist/` doesn't exist in a fresh checkout either. So **both** workspace packages need `build:dist` before the playground works.
- Build commands that exist today: `pnpm -F dtcg-tokens build:dist` (root package) and `pnpm -F dtcg-tokens-lsp build:dist`. Root `package.json` has no aggregate script.
- The Vite dev server runs on port 1234 (`app/token-playground/vite.config.ts`); a custom `rootSchemaPlugin` in that config inlines the repo-root `schema.json` as a build asset, so `vite build` output (`dist/`) is self-contained static hosting material.
- Workspace layout (`pnpm-workspace.yaml`): packages are `.`, `lsp`, `app/token-playground`.
- Repo conventions: conventional commits (`feat(playground): …`, `chore: …`).

## Commands you will need

| Purpose | Command (from repo root) | Expected on success |
|---|---|---|
| Install | `pnpm install` | exit 0 |
| Build both libs | `pnpm -F dtcg-tokens build:dist && pnpm -F dtcg-tokens-lsp build:dist` | exit 0; `dist/index.js` and `lsp/dist/server-browser.js` exist |
| Playground dev | `pnpm -F token-playground dev` (name after Step 1) | Vite ready on http://localhost:1234 |
| Playground build | `pnpm -F token-playground build` | exit 0; `app/token-playground/dist/` created |
| Preview | `pnpm -F token-playground serve` | serves the built dist |

## Scope

**In scope** (the only files you should modify):
- `app/token-playground/package.json`
- `package.json` (repo root — adding ONE aggregate script only; coordinate with plan 001 which also touches this file, but different keys)
- `app/token-playground/README.md` (update run instructions; create the run-steps section if absent)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch, even though they look related):
- `lsp/**` — do not add hooks there; plan 002 owns that manifest.
- `app/token-playground/src/**`, `vite.config.ts` — no app-code changes; this is script wiring only.
- Actually deploying to a host (Netlify/Vercel/Pages) — out of scope; this plan only guarantees the static `dist/` builds.

## Git workflow

- Branch: `advisor/003-playground-fresh-clone-dx`
- Conventional commits, e.g. `chore(playground): name the package, mark private, build workspace libs before dev`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Give the playground a real identity

In `app/token-playground/package.json`: set `"name": "token-playground"`, add `"private": true`. Keep version as-is.

**Verify**: `node -e "const p=require('./app/token-playground/package.json'); if(p.name!=='token-playground'||p.private!==true) throw 'nope'; console.log('ok')"` → `ok`

### Step 2: Add an aggregate lib-build script at the root

In root `package.json` scripts, add:

```jsonc
"build:packages": "pnpm -F dtcg-tokens build:dist && pnpm -F dtcg-tokens-lsp build:dist"
```

**Verify**: `pnpm build:packages` → exit 0; `test -f dist/index.js && test -f lsp/dist/server-browser.js` → exit 0

### Step 3: Wire it into the playground lifecycle

In `app/token-playground/package.json` scripts, add:

```jsonc
"predev": "pnpm -w build:packages",
"prebuild": "pnpm -w build:packages"
```

(`-w` runs the script from the workspace root. If the installed pnpm rejects `-w` here, use `pnpm -C ../.. build:packages`; verify the chosen form works.)

**Verify**: `rm -rf lsp/dist dist && pnpm -F token-playground build` → exit 0 and `app/token-playground/dist/index.html` exists (proves the pre-hook rebuilt the libs from nothing).

### Step 4: Smoke the dev server

`pnpm -F token-playground dev` in the background; wait for the ready line; `curl -sf http://localhost:1234 | head -5` → HTML. Then check the worker bundle resolves: the dev server must not log a module-resolution error for `dtcg-tokens-lsp/browser`. Kill the server.

**Verify**: curl returns HTML, and Vite's output contains no `Failed to resolve import "dtcg-tokens-lsp/browser"` error.

### Step 5: Document the run story

In `app/token-playground/README.md`, add/replace a "Run" section:

```markdown
## Run

```sh
pnpm install          # repo root
pnpm -F token-playground dev    # builds dtcg-tokens + dtcg-tokens-lsp dists first, then Vite on :1234
```

`pnpm -F token-playground build` emits a fully static `dist/` (repo-root `schema.json` is inlined at build time) — deployable to any static host.
```

**Verify**: `grep -n "token-playground dev" app/token-playground/README.md` → ≥ 1 match

## Test plan

No unit tests exist or are added for the playground. The machine gate is the fresh-build proof in Step 3 (`rm -rf lsp/dist dist && pnpm -F token-playground build` succeeding) plus the dev-server smoke in Step 4.

## Done criteria

- [ ] From a clean state (`rm -rf dist lsp/dist app/token-playground/dist`), `pnpm -F token-playground build` exits 0
- [ ] `app/token-playground/dist/index.html` exists after build
- [ ] Dev server serves HTML on :1234 with no `dtcg-tokens-lsp/browser` resolution error
- [ ] Playground package is named `token-playground` and `private: true`
- [ ] `git status` shows no modifications outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The `predev`/`prebuild` hooks don't fire under the installed pnpm version (pnpm supports pre/post scripts only when `enable-pre-post-scripts` is on in some versions — if hooks silently don't run, report the pnpm version and propose inlining the build into `dev`/`build` as `pnpm -w build:packages && vite` instead; that inline form is an acceptable fallback you may apply, but note it in the report).
- `vite build` fails for a reason unrelated to the missing lib dists (an app-code error means the playground has drifted — do not fix app code).
- Root `package.json` conflicts with concurrent plan-001 edits you can't cleanly merge.

## Maintenance notes

- If plan 001 later adds CI, include `pnpm -F token-playground build` as a job — it transitively proves both libraries' `build:dist` and the worker wiring.
- Schema freshness: the playground bakes repo-root `schema.json` in at build time. If core token types change, `pnpm generate-schema` must run before a deploy; consider chaining it into `build:packages` later (deliberately left out here to keep this plan's blast radius to script wiring).
- When 001/002 are published, the playground could switch from `workspace:*` to published versions — don't; workspace linkage is correct for a monorepo demo app.
