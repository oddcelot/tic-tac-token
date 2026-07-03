# Plan 002: Make `dtcg-tokens-lsp` publish-safe and publish it to npm

> **⚠️ RECONCILIATION BANNER (2026-07-03)** — Plan 001 renamed the **root package** from `dtcg-tokens` to `@oddsquad/tic-tac-token`. This plan was written before that rename. Throughout this plan, wherever a command or reference means the **root validator package** (the LSP's dependency), substitute the new name:
> - The `lsp/package.json` dependency key is now `"@oddsquad/tic-tac-token": "workspace:*"` (not `"dtcg-tokens"`).
> - `pnpm -F dtcg-tokens build:dist` → `pnpm -F @oddsquad/tic-tac-token build:dist` (and any `-w -F` / `-C .. -F` variant).
> - `npm view dtcg-tokens version` → `npm view @oddsquad/tic-tac-token version`.
> - The packed-tarball dependency check must grep for `@oddsquad/tic-tac-token` (a rewritten semver range, NOT `workspace:*`).
> - Every `dtcg-tokens-lsp` reference is **this** package and is UNCHANGED — do not touch those.
> - Open question the operator has not answered: whether this LSP package should also move to the `@oddsquad` scope (`@oddsquad/tic-tac-token-lsp`). If yes, rename this package's own `name` too; if no, keep `dtcg-tokens-lsp`. Confirm before executing.
>
> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 221fdf6..HEAD -- lsp/package.json lsp/README.md lsp/src lsp/tests`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW (script + docs), MED at the final publish step
- **Depends on**: plans/001-publish-dtcg-tokens.md (the `workspace:*` dependency can only be rewritten if `dtcg-tokens` is on the registry)
- **Category**: dx / docs / direction
- **Planned at**: commit `221fdf6`, 2026-07-03

## Why this matters

The language server is the most differentiated shippable artifact in this repo — diagnostics, resolved-value hover with color swatches, and alias/`$ref` completion for `.tokens.json` files — but `npm install -g dtcg-tokens-lsp` (the README's own install command) 404s because the package was never published. Worse, publishing naively today would ship a **broken** package: there is no `prepublishOnly` hook, `dist/` is never built automatically, and the declared `bin` points at `./dist/server.js`. Meanwhile the README *undersells* the server: completion is described as "(soon)"/"Planned (v1+)" when it is implemented and tested. This plan adds the publish guard, corrects the README, and publishes.

## Current state

- `lsp/package.json` — verified facts:
  - `"bin": { "dtcg-tokens-lsp": "./dist/server.js" }` (lines 7–9); `"files": ["dist", "README.md"]` (lines 20–23).
  - Scripts (lines 27–32): `test` (`vitest run`), `test:watch`, `build` (`tsc --noEmit`, emits nothing), `build:dist` (`tsc -p tsconfig.build.json`). **No `prepublishOnly`.** Compare the root package, which has `"prepublishOnly": "pnpm test && pnpm generate-schema && pnpm build:dist"`.
  - `"dependencies": { "dtcg-tokens": "workspace:*", "jsonc-parser": "^3.3.1", "vscode-languageserver": "^9.0.1", "vscode-languageserver-textdocument": "^1.0.12" }`.
  - Exports: `.` → `./dist/server.js`, `./browser` → `./dist/server-browser.js`.
  - No `repository`/`homepage`/`bugs`/`author`/`engines` fields.
- `lsp/src/server.ts:1` — has `#!/usr/bin/env node` shebang (bin requirement satisfied); creates the connection via `createConnection(ProposedFeatures.all)`, relying on `vscode-languageserver`'s built-in `--stdio` argv handling. The integration tests spawn `dist/server.js --stdio` over real stdio JSON-RPC.
- Implemented capabilities (verified in source): syntax + arktype-validation + resolver diagnostics (`lsp/src/handlers/diagnostics.ts`), hover with resolved values and color swatches (`lsp/src/handlers/hover.ts`, registered in `lsp/src/bootstrap.ts`), **completion for `{alias}` strings and `$ref` JSON Pointers** (`lsp/src/handlers/completion.ts`, registered in `lsp/src/bootstrap.ts`, tested in `lsp/tests/completion.test.ts`), and a browser/Worker entry (`lsp/src/server-browser.ts`).
- `lsp/README.md` inaccuracies to fix:
  - Line 3: "and (soon) navigation/completion" — completion is done.
  - Line 17: "Planned (v1+): go-to-definition, references, document symbols, context-aware completion, document colors." — completion must move out of this list; the rest (definition, references, symbols, documentColor) genuinely are unimplemented and stay.
  - Lines 19–25 ("Install" via `npm install -g dtcg-tokens-lsp`) — accurate only after this plan publishes; until Step 5 completes, it is a lie by omission.
  - The `./browser` export (used by the playground's Web Worker) is not documented at all.
- Build ordering constraint: `dtcg-tokens-lsp` imports `dtcg-tokens` (workspace dep resolving to the root package's `dist/`), and the LSP integration tests spawn the **built** `lsp/dist/server.js`. Correct order is: build core dist → build lsp dist → run lsp tests. The lsp README's Development section documents exactly this.
- No `LICENSE` file exists in `lsp/` (root LICENSE is created by plan 001; npm packages each ship their own copy).
- Repo conventions: conventional commits (`feat(lsp): …`, `chore: …`).

## Commands you will need

| Purpose | Command (from repo root) | Expected on success |
|---|---|---|
| Install | `pnpm install` | exit 0 |
| Build core dist | `pnpm -F dtcg-tokens build:dist` | exit 0; `dist/index.js` exists at repo root |
| Build lsp dist | `pnpm -F dtcg-tokens-lsp build:dist` | exit 0; `lsp/dist/server.js` exists |
| LSP tests | `pnpm -F dtcg-tokens-lsp test` | all pass (integration tests spawn `dist/server.js`) |
| Tarball preview | `cd lsp && pnpm pack && tar -tzf dtcg-tokens-lsp-*.tgz` | contains `package/dist/server.js`; then delete the .tgz |
| Rewrite check | `tar -xzOf lsp/dtcg-tokens-lsp-*.tgz package/package.json \| grep dtcg-tokens` | shows a real semver range, NOT `workspace:*` |
| Publish | `cd lsp && pnpm publish --access public` | ONLY after operator confirmation — see Step 5 |

## Scope

**In scope** (the only files you should modify):
- `lsp/package.json`
- `lsp/README.md`
- `lsp/LICENSE` (create — copy of root LICENSE from plan 001)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch, even though they look related):
- `lsp/src/**`, `lsp/tests/**` — no code changes; implementing definition/references/symbols is future scope, not this plan.
- Root `package.json`, `README.md` — plan 001's territory.
- `clients/zed/**` — plan 004's territory.
- `app/**` — plan 003's territory.

## Git workflow

- Branch: `advisor/002-publish-dtcg-tokens-lsp`
- Conventional commits, e.g. `chore(lsp): add prepublishOnly guard and publish metadata`, `docs(lsp): completion is shipped, document browser entry`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add publish guard + metadata to `lsp/package.json`

Add to scripts (order matters — dist must exist before the integration tests run, and the core dep's dist must exist before that):

```jsonc
"prepublishOnly": "pnpm -w -F dtcg-tokens build:dist && pnpm build:dist && pnpm test"
```

(If `pnpm -w -F` proves unsupported in the installed pnpm version, use `pnpm --dir .. build:dist` equivalent or `pnpm -C .. -F dtcg-tokens build:dist`; verify whichever form you use actually builds the root `dist/`.)

Add metadata fields:

```jsonc
"repository": { "type": "git", "url": "git+https://github.com/oddcelot/tic-tac-token.git", "directory": "lsp" },
"homepage": "https://github.com/oddcelot/tic-tac-token/tree/main/lsp#readme",
"bugs": { "url": "https://github.com/oddcelot/tic-tac-token/issues" },
"author": "Stefan Kopco",
"engines": { "node": ">=20" },
"publishConfig": { "access": "public" }
```

Add `"LICENSE"` to the `files` array.

**Verify**: `node -e "const p=require('./lsp/package.json'); for (const k of ['repository','author','engines','publishConfig']) if(!(k in p)) throw k; if(!p.scripts.prepublishOnly) throw 'prepublishOnly'; if(!p.files.includes('LICENSE')) throw 'files'; console.log('ok')"` → prints `ok`

### Step 2: Create `lsp/LICENSE`

Copy the root `LICENSE` created by plan 001 (`cp LICENSE lsp/LICENSE`). If root `LICENSE` doesn't exist, plan 001 hasn't run — STOP (dependency violation).

**Verify**: `test -f lsp/LICENSE` → exit 0

### Step 3: Correct the README's feature claims

In `lsp/README.md`:

1. Line 3: change "and (soon) navigation/completion" to reflect reality, e.g. "…resolved-value hover, and context-aware completion for `{alias}` strings and `$ref` JSON Pointers."
2. Add a "**Completion**" bullet to the "v0 features" list (after the Hover bullet) describing: alias-path completion inside `"{…}"` strings and JSON Pointer completion inside `"$ref": "#/…"` strings.
3. Line 17: remove "context-aware completion" from the "Planned (v1+)" list. Keep go-to-definition, references, document symbols, document colors.
4. Document the browser entry: short subsection noting `dtcg-tokens-lsp/browser` exports a Worker-ready server entry (used by the repo's Monaco playground via `import "dtcg-tokens-lsp/browser"` in a Vite Web Worker).

**Verify**: `grep -n "(soon)" lsp/README.md` → no matches; `grep -cn "completion" lsp/README.md` → ≥ 2 matches; `grep -n "browser" lsp/README.md` → ≥ 1 match

### Step 4: Prove the publish chain

```sh
pnpm install
pnpm -F dtcg-tokens build:dist
pnpm -F dtcg-tokens-lsp build:dist
pnpm -F dtcg-tokens-lsp test
cd lsp && pnpm pack
tar -tzf dtcg-tokens-lsp-*.tgz
tar -xzOf dtcg-tokens-lsp-*.tgz package/package.json | grep '"dtcg-tokens"'
node dist/server.js --stdio < /dev/null   # smoke: starts and exits without a module-resolution crash
rm dtcg-tokens-lsp-*.tgz
```

**Verify**:
- LSP tests all pass (this also confirms `--stdio` handling end-to-end — the integration tests speak real LSP JSON-RPC over stdio to the built server).
- Tarball listing contains `package/dist/server.js`, `package/dist/server-browser.js`, `package/README.md`, `package/LICENSE`; no `src/`.
- The grep on the packed `package.json` shows `"dtcg-tokens": "0.1.0"` or a `^0.1.0`-style range — **not** `workspace:*`. If `workspace:*` survives in the tarball, STOP (pnpm rewrite didn't apply; publishing would ship an uninstallable package).

### Step 5: Publish (GATED — operator confirmation required)

Preconditions: plan 001's Step 7 completed (`npm view dtcg-tokens version` → `0.1.0`) AND explicit operator confirmation in this session. Without both, stop here and mark the plan `DONE (publish pending operator)`.

With both: `cd lsp && pnpm publish --access public` (pnpm rewrites `workspace:*` to the published version at publish time and runs `prepublishOnly`).

**Verify**: `npm view dtcg-tokens-lsp version` → `0.1.0`; then in a scratch dir outside the repo: `npm install -g dtcg-tokens-lsp && dtcg-tokens-lsp --help || true` — the binary must at least resolve and execute (vscode-languageserver may not implement `--help`; "resolves and runs node" is the bar, `command not found`/`MODULE_NOT_FOUND` is a failure).

## Test plan

No new tests. The gate is the existing LSP suite run against a freshly built `dist/` (Step 4) — it covers diagnostics, hover, completion, and the stdio transport. Any failure is a STOP condition.

## Done criteria

- [ ] `pnpm -F dtcg-tokens-lsp test` exits 0 against fresh `dist/`
- [ ] `lsp/package.json` has `prepublishOnly`, `repository`, `engines`, `publishConfig`; `files` includes `LICENSE`
- [ ] Packed tarball contains `dist/server.js` and a rewritten (non-`workspace:*`) `dtcg-tokens` range
- [ ] `grep -n "(soon)" lsp/README.md` → no matches
- [ ] `git status` shows no modifications outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Root `LICENSE` or a published `dtcg-tokens` is missing (plan 001 not done) and you've reached a step that needs it.
- The packed tarball still contains `workspace:*` after using `pnpm pack` (not `npm pack` — npm does not rewrite the protocol).
- LSP tests fail twice after rebuilding both dists in the documented order.
- The `pnpm -w -F` invocation in `prepublishOnly` doesn't work in the installed pnpm and no equivalent form does — report the pnpm version and the error rather than inventing a shell workaround.
- You reach Step 5 without operator confirmation.

## Maintenance notes

- Unblocks plan 004 (Zed extension can fetch the published npm package instead of assuming a local build).
- The version pin created by the `workspace:*` rewrite means future `dtcg-tokens` releases require a lockstep `dtcg-tokens-lsp` patch release if the range is exact — reviewer should check whether pnpm emitted `0.1.0` or `^0.1.0` (workspace:* → exact by default in some pnpm versions; `workspace:^` yields caret). Prefer caret: if the tarball shows an exact pin, change the dep to `"workspace:^"` and re-pack.
- Deferred (explicitly not this plan): go-to-definition, find-references (the resolver already returns the reverse-reference graph the handler would need), document symbols, LSP `documentColor`. Also deferred: a dedicated VS Code extension — the README's "generic LSP client" guidance stands.
