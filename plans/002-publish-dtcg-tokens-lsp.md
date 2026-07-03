# Plan 002: Rename `dtcg-tokens-lsp` to `@oddsquad/tic-tac-token-lsp`, make it publish-safe, and publish it to npm

> **⚠️ RECONCILIATION BANNER (2026-07-03, v2 — supersedes the v1 banner)** — Two decisions were made after this plan was originally written:
>
> 1. Plan 001 renamed the **root package** from `dtcg-tokens` to `@oddsquad/tic-tac-token`. Wherever this plan references the root validator package as a dependency or command target, substitute the new name:
>    - `lsp/package.json`'s dependency key is now `"@oddsquad/tic-tac-token": "workspace:*"` (not `"dtcg-tokens"`).
>    - `pnpm -F dtcg-tokens build:dist` → `pnpm -F @oddsquad/tic-tac-token build:dist` (and any `-w -F` / `-C .. -F` variant).
>    - `npm view dtcg-tokens version` → `npm view @oddsquad/tic-tac-token version`.
>    - The packed-tarball dependency check must grep for `@oddsquad/tic-tac-token` (a rewritten semver range, NOT `workspace:*`).
>
> 2. **The operator has since confirmed the LSP package itself also moves to the scope: `@oddsquad/tic-tac-token-lsp`.** This plan has been rewritten (v2) to perform that rename. **Judgment call, not confirmed with the operator — flag if wrong**: only the npm **package name** changes. The CLI **bin command** (`dtcg-tokens-lsp`), the LSP `serverInfo.name` reported over the protocol, the playground's `MARKER_OWNER` diagnostic-source string, and Zed's `language_servers.dtcg-tokens-lsp` config key all stay `dtcg-tokens-lsp` unchanged — these are user-facing/protocol identifiers independent of the npm package name, and renaming them is a separate, larger branding decision this plan does not make. If the operator actually wants the bin/protocol identity renamed too, that's a follow-up plan, not a silent addition here.
>
> Every `dtcg-tokens-lsp` string in this plan below refers to one of two things — read carefully, they are handled differently:
> - **The npm package name / import specifier / `pnpm -F` filter target / workspace dependency key** → rename to `@oddsquad/tic-tac-token-lsp`.
> - **The bin command, `serverInfo.name`, diagnostic/marker labels, editor config keys** → leave as literal `dtcg-tokens-lsp`, unchanged.
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
- **Effort**: M (was S — the scope rename adds a consumer ripple into `app/token-playground`, same shape as plan 001's root-package rename)
- **Risk**: LOW–MED (rename + script + docs), MED at the final publish step
- **Depends on**: plans/001-publish-dtcg-tokens.md (`@oddsquad/tic-tac-token` must be on the registry before the `workspace:*` dependency can be rewritten to a real range at publish time) — **plan 001 is DONE, published** as of 2026-07-03.
- **Category**: dx / docs / direction
- **Planned at**: commit `221fdf6`, 2026-07-03
- **Rewritten (v2)**: 2026-07-03 — operator confirmed the LSP package should also move to the `@oddsquad` scope. Scope expanded accordingly.

## Why this matters

The language server is the most differentiated shippable artifact in this repo — diagnostics, resolved-value hover with color swatches, and alias/`$ref` completion for `.tokens.json` files — but `npm install -g dtcg-tokens-lsp` (the README's own install command) 404s because the package was never published. Worse, publishing naively today would ship a **broken** package: there is no `prepublishOnly` hook, `dist/` is never built automatically, and the declared `bin` points at `./dist/server.js`. Meanwhile the README *undersells* the server: completion is described as "(soon)"/"Planned (v1+)" when it is implemented and tested. This plan adds the publish guard, corrects the README, renames the package to match the now-published root scope, and publishes.

The rename ripples the same way plan 001's did: `app/token-playground` depends on `dtcg-tokens-lsp` by its bare name (`workspace:*` dependency key) and imports its browser subpath (`dtcg-tokens-lsp/browser`) by that same bare name — both must be updated or the playground breaks, even though the LSP's own tests would stay green (they reference the package via relative source, not the published name).

## Current state

- `lsp/package.json` — verified facts:
  - `"name": "dtcg-tokens-lsp"` — **this is what changes**, to `"@oddsquad/tic-tac-token-lsp"`.
  - `"bin": { "dtcg-tokens-lsp": "./dist/server.js" }` (lines 7–9) — **the bin key stays `dtcg-tokens-lsp` unchanged** (see banner — a separate decision from the package name).
  - `"files": ["dist", "README.md"]` (lines 20–23).
  - Scripts (lines 27–32): `test` (`vitest run`), `test:watch`, `build` (`tsc --noEmit`, emits nothing), `build:dist` (`tsc -p tsconfig.build.json`). **No `prepublishOnly`.** Compare the root package, which has `"prepublishOnly": "pnpm test && pnpm generate-schema && pnpm build:dist"`.
  - `"dependencies": { "@oddsquad/tic-tac-token": "workspace:*", "jsonc-parser": "^3.3.1", "vscode-languageserver": "^9.0.1", "vscode-languageserver-textdocument": "^1.0.12" }` (already renamed by plan 001).
  - Exports: `.` → `./dist/server.js`, `./browser` → `./dist/server-browser.js` — unchanged, subpaths are relative to the package and survive a name change.
  - No `repository`/`homepage`/`bugs`/`author`/`engines` fields.
- `lsp/src/bootstrap.ts:62` — `serverInfo: { name: "dtcg-tokens-lsp", version: "0.1.0" }` — **stays unchanged** (protocol-level server identity, not the npm package name — see banner).
- Consumers importing the LSP package by its bare npm name (these break on rename, must be updated in lockstep):
  - `app/token-playground/package.json:25` — dependency key `"dtcg-tokens-lsp": "workspace:*"`.
  - `app/token-playground/src/lsp/worker.ts:5` — `import "dtcg-tokens-lsp/browser";` — this is a real module-resolution import and MUST become `import "@oddsquad/tic-tac-token-lsp/browser";`.
  - `app/token-playground/src/lsp/client.ts:205` — `const MARKER_OWNER = "dtcg-tokens-lsp";` — **stays unchanged**, this is a Monaco diagnostic-owner label, not an import specifier (same category as `serverInfo.name`, see banner).
  - `app/token-playground/src/lsp/client.ts:22` — a comment mentioning `dtcg-tokens-lsp browser entry` — cosmetic, update if trivial, not required.
- `lsp/src/server.ts:1` — has `#!/usr/bin/env node` shebang (bin requirement satisfied); creates the connection via `createConnection(ProposedFeatures.all)`, relying on `vscode-languageserver`'s built-in `--stdio` argv handling. The integration tests spawn `dist/server.js --stdio` over real stdio JSON-RPC.
- Implemented capabilities (verified in source): syntax + arktype-validation + resolver diagnostics (`lsp/src/handlers/diagnostics.ts`), hover with resolved values and color swatches (`lsp/src/handlers/hover.ts`, registered in `lsp/src/bootstrap.ts`), **completion for `{alias}` strings and `$ref` JSON Pointers** (`lsp/src/handlers/completion.ts`, registered in `lsp/src/bootstrap.ts`, tested in `lsp/tests/completion.test.ts`), and a browser/Worker entry (`lsp/src/server-browser.ts`).
- `lsp/README.md` — two categories of `dtcg-tokens-lsp` references, handled differently (re-verify exact line numbers before editing, this file has been touched by plan 001's reconciliation since these were counted):
  - **Package-name references (change to `@oddsquad/tic-tac-token-lsp`)**: the H1 title (`# dtcg-tokens-lsp`), the `npm install -g dtcg-tokens-lsp` install command, the `pnpm -F dtcg-tokens-lsp build:dist` / `pnpm -F dtcg-tokens-lsp test` Development-section commands (`pnpm -F` filters by package `name`).
  - **Bin/protocol-identity references (leave unchanged)**: "the package ships a `dtcg-tokens-lsp` bin", and every editor-config example where `dtcg-tokens-lsp` is the literal command/binary users type or a server-registration key (VS Code `languageServerClient.servers`, Zed `language_servers`, Neovim `cmd`, Helix `[language-server.dtcg-tokens-lsp]`) — these all reference the **bin name**, which is not changing.
  - Also still true from the original audit: line "and (soon) navigation/completion" — completion is done; "Planned (v1+): go-to-definition, references, document symbols, context-aware completion, document colors." — completion must move out of this list; the rest (definition, references, symbols, documentColor) genuinely are unimplemented and stay; the `./browser` export is not documented at all.
- Build ordering constraint: the LSP imports the root package (workspace dep resolving to its `dist/`), and the LSP integration tests spawn the **built** `lsp/dist/server.js`. Correct order is: build core dist → build lsp dist → run lsp tests. The lsp README's Development section documents exactly this.
- No `LICENSE` file exists in `lsp/` (root `LICENSE` was created by plan 001; npm packages each ship their own copy).
- `clients/zed/**` is explicitly out of scope for this plan (plan 004's territory) — its `extension.toml` `[language_servers.dtcg-tokens-lsp]` key and `id = "dtcg-tokens"` are Zed-local identifiers, not npm package references, and are unaffected by this rename. `clients/zed/README.md`'s `pnpm -F dtcg-tokens-lsp build:dist` dev-instruction line WILL go stale once this plan renames the package — flagged in plan 004's reconciliation banner rather than fixed here, to keep this plan's diff limited to its own package's ecosystem (mirrors how plan 001 left `clients/zed` alone and let plan 004 absorb the drift).
- Repo conventions: conventional commits (`feat(lsp): …`, `chore: …`).

## Commands you will need

| Purpose | Command (from repo root) | Expected on success |
|---|---|---|
| Install | `pnpm install` | exit 0 (re-links the workspace under the new LSP name) |
| Build core dist | `pnpm -F @oddsquad/tic-tac-token build:dist` | exit 0; `dist/index.js` exists at repo root |
| Build lsp dist | `pnpm -F @oddsquad/tic-tac-token-lsp build:dist` | exit 0; `lsp/dist/server.js` exists |
| LSP tests | `pnpm -F @oddsquad/tic-tac-token-lsp test` | all pass (integration tests spawn `dist/server.js`) |
| Playground build (consumer proof) | `pnpm -F token-playground build` | exit 0 — proves the playground resolves the renamed `@oddsquad/tic-tac-token-lsp/browser` import |
| Tarball preview | `cd lsp && pnpm pack && tar -tzf oddsquad-tic-tac-token-lsp-*.tgz` | contains `package/dist/server.js`; then delete the .tgz |
| Rewrite check | `tar -xzOf lsp/oddsquad-tic-tac-token-lsp-*.tgz package/package.json \| grep "@oddsquad/tic-tac-token"` | shows a real semver range, NOT `workspace:*` |
| Publish | `cd lsp && pnpm publish --access public` | ONLY after operator confirmation — see Step 5 |

> **Note**: `app/token-playground`'s own `package.json` `name` is `"vite-template-solid"` (unrelated boilerplate name, not renamed by any plan) — its `pnpm -F` filter target is `token-playground`... **verify this before running**: check the actual `name` field live, do not assume; if it really is `vite-template-solid`, use `pnpm -F vite-template-solid build` instead and note the mismatch in your report rather than silently working around it.

## Scope

**In scope** (the only files you should modify):
- `lsp/package.json` (rename `name`; bin key, dependencies, scripts, metadata per Step 1)
- `lsp/README.md`
- `lsp/LICENSE` (create — copy of root LICENSE from plan 001)
- `app/token-playground/package.json` (dependency key only: `dtcg-tokens-lsp` → `@oddsquad/tic-tac-token-lsp`)
- `app/token-playground/src/lsp/worker.ts` (import specifier only)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch, even though they look related):
- `lsp/src/**`, `lsp/tests/**` — no code changes; `serverInfo.name` in `bootstrap.ts` stays `dtcg-tokens-lsp` (see banner) and implementing definition/references/symbols is future scope, not this plan.
- `app/token-playground/src/lsp/client.ts` — `MARKER_OWNER` stays `dtcg-tokens-lsp` (a diagnostic-owner label, not an import specifier — see banner); leave the whole file untouched unless you're only fixing the cosmetic comment at line 22, which is optional.
- Root `package.json`, `README.md` — plan 001's territory (already done).
- `clients/zed/**` — plan 004's territory; its stale `pnpm -F dtcg-tokens-lsp build:dist` dev-instruction is plan 004's problem to reconcile, not this plan's.
- Any other `app/**` file — plan 003's territory.

## Git workflow

- Branch: `advisor/002-publish-oddsquad-tic-tac-token-lsp`
- Conventional commits, e.g. `chore(lsp): rename package to @oddsquad/tic-tac-token-lsp`, `refactor(app): update playground import to the scoped LSP package name`, `chore(lsp): add prepublishOnly guard and publish metadata`, `docs(lsp): completion is shipped, document browser entry`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Rename `lsp/package.json` and update its two consumers

Change `"name": "dtcg-tokens-lsp"` → `"name": "@oddsquad/tic-tac-token-lsp"`. Do NOT change the `"bin"` key (stays `{ "dtcg-tokens-lsp": "./dist/server.js" }`) — see the banner.

Then:
- `app/token-playground/package.json` — rename the dependency key `"dtcg-tokens-lsp": "workspace:*"` → `"@oddsquad/tic-tac-token-lsp": "workspace:*"`. Change only the key, keep the value.
- `app/token-playground/src/lsp/worker.ts:5` — `import "dtcg-tokens-lsp/browser";` → `import "@oddsquad/tic-tac-token-lsp/browser";`.

Do NOT touch `app/token-playground/src/lsp/client.ts`'s `MARKER_OWNER` — it stays `"dtcg-tokens-lsp"`.

**Verify**: `node -e "const p=require('./lsp/package.json'); if(p.name!=='@oddsquad/tic-tac-token-lsp') throw 'name'; if(!p.bin['dtcg-tokens-lsp']) throw 'bin'; console.log('ok')"` → `ok`; `grep -n '"dtcg-tokens-lsp":' app/token-playground/package.json` → no matches; `grep -n '"@oddsquad/tic-tac-token-lsp":' app/token-playground/package.json` → 1 match; `grep -n "dtcg-tokens-lsp/browser" app/token-playground/src/lsp/worker.ts` → no matches; `grep -n "@oddsquad/tic-tac-token-lsp/browser" app/token-playground/src/lsp/worker.ts` → 1 match

### Step 2: Add publish guard + metadata to `lsp/package.json`

Add to scripts (order matters — dist must exist before the integration tests run, and the core dep's dist must exist before that):

```jsonc
"prepublishOnly": "pnpm -w -F @oddsquad/tic-tac-token build:dist && pnpm build:dist && pnpm test"
```

(If `pnpm -w -F` proves unsupported in the installed pnpm version, use `pnpm --dir .. build:dist` equivalent or `pnpm -C .. -F @oddsquad/tic-tac-token build:dist`; verify whichever form you use actually builds the root `dist/`.)

Add metadata fields:

```jsonc
"repository": { "type": "git", "url": "git+https://github.com/oddcelot/tic-tac-token.git", "directory": "lsp" },
"homepage": "https://github.com/oddcelot/tic-tac-token/tree/main/lsp#readme",
"bugs": { "url": "https://github.com/oddcelot/tic-tac-token/issues" },
"author": "Stefan Kopco",
"engines": { "node": ">=20" },
"publishConfig": { "access": "public" }
```

`publishConfig.access: public` is required for a scoped package (defaults to restricted otherwise). Add `"LICENSE"` to the `files` array.

**Verify**: `node -e "const p=require('./lsp/package.json'); for (const k of ['repository','author','engines','publishConfig']) if(!(k in p)) throw k; if(p.publishConfig.access!=='public') throw 'access'; if(!p.scripts.prepublishOnly) throw 'prepublishOnly'; if(!p.files.includes('LICENSE')) throw 'files'; console.log('ok')"` → prints `ok`

### Step 3: Create `lsp/LICENSE`

Copy the root `LICENSE` created by plan 001 (`cp LICENSE lsp/LICENSE`). If root `LICENSE` doesn't exist, plan 001 hasn't run — STOP (dependency violation).

**Verify**: `test -f lsp/LICENSE` → exit 0

### Step 4: Correct the README's feature claims and package-name references

In `lsp/README.md`, two independent edits:

**A. Feature accuracy** (unrelated to the rename):
1. The line describing "(soon) navigation/completion" — change to reflect reality, e.g. "…resolved-value hover, and context-aware completion for `{alias}` strings and `$ref` JSON Pointers."
2. Add a "**Completion**" bullet to the "v0 features" list (after the Hover bullet) describing: alias-path completion inside `"{…}"` strings and JSON Pointer completion inside `"$ref": "#/…"` strings.
3. The "Planned (v1+)" list — remove "context-aware completion". Keep go-to-definition, references, document symbols, document colors.
4. Document the browser entry: short subsection noting `@oddsquad/tic-tac-token-lsp/browser` exports a Worker-ready server entry (used by the repo's Monaco playground via `import "@oddsquad/tic-tac-token-lsp/browser"` in a Vite Web Worker).

**B. Package-name rename** — re-read the file first and classify each `dtcg-tokens-lsp` occurrence per the banner's two categories before editing:
- Change to `@oddsquad/tic-tac-token-lsp`: the H1 title, the `npm install -g dtcg-tokens-lsp` command, the `pnpm -F dtcg-tokens-lsp build:dist` / `pnpm -F dtcg-tokens-lsp test` Development-section commands.
- Leave unchanged: "the package ships a `dtcg-tokens-lsp` bin", and every editor-config example (VS Code, Zed, Neovim, Helix) where `dtcg-tokens-lsp` is the literal bin/command name or a server-registration key.

**Verify**: `grep -n "(soon)" lsp/README.md` → no matches; `grep -cn "completion" lsp/README.md` → ≥ 2 matches; `grep -n "browser" lsp/README.md` → ≥ 1 match; `grep -n "^# " lsp/README.md` → title is `# @oddsquad/tic-tac-token-lsp`; `grep -n "npm install -g" lsp/README.md` → shows `@oddsquad/tic-tac-token-lsp`; `grep -n "pnpm -F dtcg-tokens-lsp" lsp/README.md` → no matches (both `pnpm -F` commands renamed); `grep -c '"dtcg-tokens-lsp"' lsp/README.md` → still several matches (the bin/editor-config references that correctly did NOT change)

### Step 5: Prove the publish chain

```sh
pnpm install
pnpm -F @oddsquad/tic-tac-token build:dist
pnpm -F @oddsquad/tic-tac-token-lsp build:dist
pnpm -F @oddsquad/tic-tac-token-lsp test
pnpm -F token-playground build   # or vite-template-solid — verify the real name field first, see the Commands note above
cd lsp && pnpm pack
tar -tzf oddsquad-tic-tac-token-lsp-*.tgz
tar -xzOf oddsquad-tic-tac-token-lsp-*.tgz package/package.json | grep '"@oddsquad/tic-tac-token"'
node dist/server.js --stdio < /dev/null   # smoke: starts and exits without a module-resolution crash
rm oddsquad-tic-tac-token-lsp-*.tgz
```

**Verify**:
- LSP tests all pass (this also confirms `--stdio` handling end-to-end — the integration tests speak real LSP JSON-RPC over stdio to the built server).
- The playground build exits 0 — **this is the rename-resolution proof**: `Cannot find module '@oddsquad/tic-tac-token-lsp/browser'` or any lingering `dtcg-tokens-lsp` resolution error means the rename is incomplete — STOP.
- Tarball listing contains `package/dist/server.js`, `package/dist/server-browser.js`, `package/README.md`, `package/LICENSE`; no `src/`.
- The grep on the packed `package.json` shows `"@oddsquad/tic-tac-token": "0.1.0"` or a `^0.1.0`-style range — **not** `workspace:*`. If `workspace:*` survives in the tarball, STOP (pnpm rewrite didn't apply; publishing would ship an uninstallable package).

### Step 6: Publish (GATED — operator confirmation required)

Publishing claims `@oddsquad/tic-tac-token-lsp` on npm permanently. Preconditions: plan 001 published (`npm view @oddsquad/tic-tac-token version` → `0.1.0` — already true as of 2026-07-03) AND explicit operator confirmation in this session for *this* publish. Without confirmation, stop here and mark the plan `DONE (publish pending operator)`.

Also verify (same as plan 001): `npm whoami` succeeds and the account owns/is a member of the `@oddsquad` npm org.

With confirmation: `cd lsp && pnpm publish --access public` (pnpm rewrites `workspace:*` to the published root-package version at publish time and runs `prepublishOnly`).

**Verify**: `npm view @oddsquad/tic-tac-token-lsp version` → `0.1.0`; then in a scratch dir outside the repo: `npm install -g @oddsquad/tic-tac-token-lsp && dtcg-tokens-lsp --help || true` (the bin command is still `dtcg-tokens-lsp`, not the scoped package name) — the binary must at least resolve and execute (vscode-languageserver may not implement `--help`; "resolves and runs node" is the bar, `command not found`/`MODULE_NOT_FOUND` is a failure).

## Test plan

No new tests. The gate is the existing LSP suite run against a freshly built `dist/` (Step 5), plus the playground build as the consumer-resolution proof for the rename. Any failure is a STOP condition.

## Done criteria

- [ ] `lsp/package.json` name is `@oddsquad/tic-tac-token-lsp`; `bin` key still `dtcg-tokens-lsp`
- [ ] `app/token-playground/package.json` + `worker.ts` updated to the renamed LSP package; `client.ts`'s `MARKER_OWNER` untouched
- [ ] `pnpm -F @oddsquad/tic-tac-token-lsp test` exits 0 against fresh `dist/`
- [ ] Playground build exits 0 (proves consumer resolution)
- [ ] `lsp/package.json` has `prepublishOnly`, `repository`, `engines`, `publishConfig.access:"public"`; `files` includes `LICENSE`
- [ ] Packed tarball contains `dist/server.js` and a rewritten (non-`workspace:*`) `@oddsquad/tic-tac-token` range
- [ ] `grep -n "(soon)" lsp/README.md` → no matches; README title and install command use the new scoped name; bin/editor-config references still say `dtcg-tokens-lsp`
- [ ] `git status` shows no modifications outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Root `LICENSE` or a published `@oddsquad/tic-tac-token` is missing (plan 001 not done — though as of 2026-07-03 it is) and you've reached a step that needs it.
- After the rename, `pnpm -F token-playground build` (or whatever the playground's real package name turns out to be) fails to resolve `@oddsquad/tic-tac-token-lsp/browser`.
- The packed tarball still contains `workspace:*` after using `pnpm pack` (not `npm pack` — npm does not rewrite the protocol).
- LSP tests fail twice after rebuilding both dists in the documented order.
- The `pnpm -w -F` invocation in `prepublishOnly` doesn't work in the installed pnpm and no equivalent form does — report the pnpm version and the error rather than inventing a shell workaround.
- You reach Step 6 without operator confirmation, or `npm whoami` fails / the `@oddsquad` scope isn't owned by the account.

## Maintenance notes

- Unblocks plan 004 (Zed extension can fetch the published npm package instead of assuming a local build) — **plan 004 must be updated to reference `@oddsquad/tic-tac-token-lsp` as the npm package to install/check, while keeping `dtcg-tokens-lsp` as the bin it actually invokes.** A reconciliation banner has been added to plan 004 for this.
- The version pin created by the `workspace:*` rewrite means future root-package releases require a lockstep LSP patch release if the range is exact — reviewer should check whether pnpm emitted `0.1.0` or `^0.1.0` (workspace:* → exact by default in some pnpm versions; `workspace:^` yields caret). Prefer caret: if the tarball shows an exact pin, change the dep to `"workspace:^"` and re-pack.
- If a future decision also renames the bin/`serverInfo.name`/`MARKER_OWNER`/Zed config key to match the new scope, that's a separate, larger plan — it touches user-facing editor configs and any external doc telling people to run `dtcg-tokens-lsp`, and deserves its own drift analysis rather than being folded in here.
- Deferred (explicitly not this plan): go-to-definition, find-references (the resolver already returns the reverse-reference graph the handler would need), document symbols, LSP `documentColor`. Also deferred: a dedicated VS Code extension — the README's "generic LSP client" guidance stands.
