# Plan 001: Rename the root package to `@oddsquad/tic-tac-token`, make it publish-ready, and publish it to npm

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 221fdf6..HEAD -- package.json README.md LICENSE package-lock.json lsp/package.json lsp/README.md lsp/src app/token-playground/package.json app/token-playground/src`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M (rename ripples across two consumer packages; was S when the name was unchanged)
- **Risk**: LOW for the metadata/docs edits; MED for the cross-workspace rename (must not break `lsp`/`app` resolution); MED at the final publish step (claiming the npm name is permanent)
- **Depends on**: none
- **Category**: dx / docs / direction
- **Planned at**: commit `221fdf6`, 2026-07-03
- **Rewritten**: 2026-07-03 — operator chose the scoped name `@oddsquad/tic-tac-token` instead of the unscoped `dtcg-tokens`. This changes the package `name`, which is the bare import specifier every workspace consumer uses, so the scope now includes the `lsp` and `app` files that import the root package. `@oddsquad/tic-tac-token` verified available on npm (E404) on 2026-07-03.

## Why this matters

The repo root package (currently named `dtcg-tokens`) is a complete, tested runtime validator + resolver for DTCG 2025.10 design tokens, but it has never been published — both `npm view dtcg-tokens version` and `npm view @oddsquad/tic-tac-token version` return E404 (verified 2026-07-03). Everything downstream (the `dtcg-tokens-lsp` package, the Zed extension, the token playground, any external consumer) is blocked on this publish because the LSP declares the root package as `"workspace:*"`, which can only be rewritten to a real semver range at publish time if the package already exists on the registry under its final name.

The operator has chosen to publish under the scoped name **`@oddsquad/tic-tac-token`**. Because a pnpm workspace resolves a workspace package by its `name`, renaming the root package requires updating every consumer that imports it by the old bare name `dtcg-tokens` (the LSP source, the playground source, and both of their `package.json` dependency keys) — otherwise those packages fail to resolve their imports after the rename, even though the root package's own tests still pass (they import relatively).

Separately, the README actively misrepresents the package: it says the resolver is "out of scope" when a full resolver pipeline is implemented, tested, and exported at the `./resolver` subpath. This plan performs the rename, fixes the metadata and docs, verifies the publish chain and workspace coherence end-to-end, and publishes.

## Current state

### Root package (`package.json`)

Verified facts at commit `221fdf6`:

- `"name": "dtcg-tokens"` (line 2), `"version": "0.1.0"` (line 3). **This name is what changes.**
- No `repository`, `homepage`, `bugs`, `author`, or `engines` field anywhere in the file.
- `"files": ["dist", "schema.json", "README.md"]` (lines 19–23).
- `"license": "ISC"` (line 33), but **no `LICENSE` file exists** in the repo root.
- `"prepublishOnly": "pnpm test && pnpm generate-schema && pnpm build:dist"` (line 40).
- Exports map already has `.`, `./resolver`, `./schema.json` (lines 8–17) — correct, do NOT change (subpaths are relative to the package, so they survive the rename unchanged).
- Root tests and sources import from `./src` **relatively** (verified: no bare `dtcg-tokens` specifier appears anywhere under `src/` or `tests/`), so the rename does not touch them and root `pnpm test` / `build:dist` are unaffected by it.

### Consumers that import the root package by its bare name (these break on rename)

- `lsp/package.json:39` — dependency key `"dtcg-tokens": "workspace:*"`.
- `lsp/src/analyzer.ts:1` — `import { TokensFile } from "dtcg-tokens";`
- `lsp/src/analyzer.ts:2` — `import { resolveTokens, type ResolvedTokens } from "dtcg-tokens/resolver";`
- `lsp/src/handlers/hover.ts:1` — `import type { FlatToken } from "dtcg-tokens/resolver";`
- `lsp/src/handlers/hover.ts:2` — `import { flattenTokens, isTokenType } from "dtcg-tokens/resolver";`
- `lsp/src/handlers/completion.ts:1` — `import { flattenTokens } from "dtcg-tokens/resolver";`
- `lsp/src/utils/hover-markdown.ts:1` — `import type { FlatToken } from "dtcg-tokens/resolver";`
- `app/token-playground/package.json:24` — dependency key `"dtcg-tokens": "workspace:*"`.
- `app/token-playground/src/tokens.ts:1` — `import { resolveTokens } from "dtcg-tokens/resolver";`
- `app/token-playground/src/tokens.ts:2` — `import type { FlatToken, TokenType } from "dtcg-tokens/resolver";`
- `lsp/README.md` — line 5 `[`dtcg-tokens`](../README.md)`, line 99 `**`dtcg-tokens`**`, line 100 `**`dtcg-tokens/resolver`**`, and the build command `pnpm -F dtcg-tokens build:dist` (line 107) all name the root package.

### NOT the root package — do NOT rename these

- `dtcg-tokens-lsp` — the **LSP package's own name** (`lsp/package.json:2`, `lsp/src/bootstrap.ts:62`, and the many `dtcg-tokens-lsp` references in `lsp/README.md` and `clients/zed/`). It is a different package, covered by plan 002. Leave it exactly as-is.
- `lsp/src/handlers/diagnostics.ts:10` — `const SOURCE = "dtcg-tokens";`. This is the diagnostic **source label** shown in the editor, not a module specifier and not the package name. Leave it unchanged (renaming it is a user-visible LSP behavior change outside this plan's intent).

### Other current-state facts

- `README.md:127-129` — the false claim to rewrite:

  ```markdown
  ## Resolver

  Currently out of scope for this package — `dtcg-tokens` validates structure but does not yet resolve references, apply `$extends` deep-merge, clamp gradient positions, or inherit group-level `$type` to children. The [roadmap](./docs/roadmap.md) tracks the resolver lift.
  ```

  In reality `src/resolver/index.ts:34-54` exports `resolveTokens(root: unknown): ResolvedTokens`, a 5-stage pipeline: 1. `$extends` deep-merge → 2. `$ref` dereference (token-root + nested) → 3. flatten with group-`$type` inheritance → 4. `{alias}` resolution → 5. gradient position clamping. It returns `{ tokens, byPath, errors, references }` and re-exports the individual stages (`resolveRefs`, `applyExtends`, `flattenTokens`, `resolveAliases`, `clampGradients`, `jsonPointerGet`) and types (`FlatToken`, `ResolverError`, `ResolvedTokens`, `TokenType`, `TOKEN_TYPES`, `isTokenType`).
- `README.md` also uses the old name in the title (line 1), install snippet (lines 10–11), and import examples (lines 17, 55, 115). All of these become `@oddsquad/tic-tac-token`.
- `README.md:120` links `[docs/dtcg-spec.md](./docs/dtcg-spec.md)` and line 129 links `./docs/roadmap.md` — `docs/` is not in the `files` allowlist, so both links are dead on the npm package page.
- Both `package-lock.json` and `pnpm-lock.yaml` are committed; the repo is a pnpm workspace (`pnpm-workspace.yaml`) and every script uses pnpm — the npm lockfile is drift rot.
- `schema.json` is fresh: last regenerated in commit `d1ee6aa`, same commit as the last change to the schema-relevant sources.
- Git remote: `https://github.com/oddcelot/tic-tac-token.git`. Git user: Stefan Kopco.
- Known upstream constraint (documented in `docs/arktype-json-schema-bug.md`): the emitted JSON Schema describes individual token shapes, not the full recursive group structure, due to an arktype `toJsonSchema` limitation. By-design — do not try to fix it in this plan.
- Repo conventions: conventional commits (`feat(lsp): …`, `chore(build): …`, `fix(tokens): …`). TypeScript sources use `.ts` extension imports (erasable-syntax style). Subpath import specifiers (`/resolver`) are preserved verbatim across the rename — only the package portion changes.
- Node context: `generate-schema` runs `node generate-schema.ts` (native type stripping — needs Node ≥ 23.6 unflagged; `.prototools` pins `node = "24.2.0"`). Consumers of the published `dist/` JS do NOT need type stripping.

## Commands you will need

| Purpose | Command (from repo root) | Expected on success |
|---|---|---|
| Install | `pnpm install` | exit 0 (re-links the workspace under the new name) |
| Root tests | `pnpm test` | all pass, exit 0 |
| Root typecheck | `pnpm build` | exit 0 (this is `tsc --noEmit`) |
| Schema regen | `pnpm generate-schema` | exit 0; `git diff schema.json` empty |
| Emit root dist | `pnpm build:dist` | exit 0; `dist/index.js` and `dist/resolver/index.js` exist |
| Build LSP (consumer) | `pnpm -F @oddsquad/tic-tac-token-lsp build:dist` | exit 0 — proves the LSP resolves the renamed import |
| LSP tests (consumer) | `pnpm -F @oddsquad/tic-tac-token-lsp test` | ⚠️ the LSP is still named `dtcg-tokens-lsp` in this plan — use `pnpm -F dtcg-tokens-lsp build:dist` / `pnpm -F dtcg-tokens-lsp test` (see note below) |
| Tarball preview | `npm pack --dry-run` | file list shows `dist/**`, `schema.json`, `README.md`, `LICENSE`, `package.json` and nothing else |
| Publish | `pnpm publish --access public` | ONLY after operator confirmation — see Step 8 |

> **Filter-name note**: `pnpm -F <name>` matches a package by its `name` field. The LSP package is **not** renamed by this plan — it stays `dtcg-tokens-lsp` — so its filter commands remain `pnpm -F dtcg-tokens-lsp …`. Only the **root** package's filter name would change, but the root package has no `-F` self-reference. Use `pnpm -F dtcg-tokens-lsp build:dist` and `pnpm -F dtcg-tokens-lsp test` for the consumer-build verification.

## Scope

**In scope** (the only files you should modify):

Root (metadata + docs):
- `package.json` (rename + publish metadata)
- `README.md`
- `LICENSE` (create)
- `package-lock.json` (delete)

Consumers (rename ripple — mechanically required so the workspace still resolves):
- `lsp/package.json` (dependency key only)
- `lsp/src/analyzer.ts`
- `lsp/src/handlers/hover.ts`
- `lsp/src/handlers/completion.ts`
- `lsp/src/utils/hover-markdown.ts`
- `lsp/README.md` (root-package references + the `pnpm -F dtcg-tokens build:dist` command → `pnpm -F @oddsquad/tic-tac-token build:dist`)
- `app/token-playground/package.json` (dependency key only)
- `app/token-playground/src/tokens.ts`

Index:
- `plans/README.md` (status row) — SKIP if a reviewer told you they maintain the index.

**Out of scope** (do NOT touch, even though they look related):
- `src/**`, `tests/**`, `generate-schema.ts`, `schema.json` — no code or schema changes; root sources import relatively and are unaffected by the rename. If verification surfaces a code failure here, that's a STOP condition, not a fix-it-here.
- The `dtcg-tokens-lsp` **package name** and every `dtcg-tokens-lsp` reference — that's plan 002's package, not this one.
- `lsp/src/handlers/diagnostics.ts` (`SOURCE` label) and `lsp/src/bootstrap.ts` (`serverInfo.name`) — not the root package name.
- `clients/zed/**`, `figma-plugin/**` — no reference to the root package by name.
- `docs/**` — link *to* them, don't edit them.
- All other `plans/*.md` — the reviewer/advisor reconciles those.

## Git workflow

- Branch: `advisor/001-publish-oddsquad-tic-tac-token`
- Conventional commits, one per logical unit, e.g. `chore(pkg): rename root package to @oddsquad/tic-tac-token`, `refactor(lsp,app): update imports to the scoped package name`, `chore(pkg): add publish metadata and LICENSE`, `docs(readme): document the resolver export`, `chore: drop stale package-lock.json`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Rename the root package and add publish metadata (`package.json`)

Change `"name": "dtcg-tokens"` → `"name": "@oddsquad/tic-tac-token"`.

Add these fields (keep existing fields untouched; do NOT change `version`, `exports`, `main`, `types`, `keywords`, `scripts`, or `dependencies`):

```jsonc
"repository": { "type": "git", "url": "git+https://github.com/oddcelot/tic-tac-token.git" },
"homepage": "https://github.com/oddcelot/tic-tac-token#readme",
"bugs": { "url": "https://github.com/oddcelot/tic-tac-token/issues" },
"author": "Stefan Kopco",
"engines": { "node": ">=20" },
"sideEffects": false,
"publishConfig": { "access": "public" }
```

Notes:
- `"publishConfig": { "access": "public" }` is **required** for a scoped package — scoped packages default to restricted (private) and would fail to publish on a free account without it.
- `engines` `>=20` covers consumers (plain ESM `dist/` output). Do NOT set `>=23.6` — that's only a maintainer requirement for `generate-schema`.

Also add `"LICENSE"` to the `files` array.

**Verify**: `node -e "const p=require('./package.json'); if(p.name!=='@oddsquad/tic-tac-token') throw 'name'; for (const k of ['repository','homepage','bugs','author','engines','sideEffects','publishConfig']) if(!(k in p)) throw k; if(p.publishConfig.access!=='public') throw 'access'; if(!p.files.includes('LICENSE')) throw 'files'; console.log('ok')"` → prints `ok`

### Step 2: Update the two consumer dependency keys

In `lsp/package.json` and `app/token-playground/package.json`, rename the dependency key `"dtcg-tokens": "workspace:*"` → `"@oddsquad/tic-tac-token": "workspace:*"`. Change **only** the key string; keep the `"workspace:*"` value and do not touch the `dtcg-tokens-lsp` entry (in the app manifest).

**Verify**: `grep -rn '"dtcg-tokens":' lsp/package.json app/token-playground/package.json` → no matches; `grep -rn '"@oddsquad/tic-tac-token":' lsp/package.json app/token-playground/package.json` → 2 matches.

### Step 3: Update consumer import specifiers

Rewrite the bare specifier `dtcg-tokens` → `@oddsquad/tic-tac-token` (and `dtcg-tokens/resolver` → `@oddsquad/tic-tac-token/resolver`) in exactly these files:

- `lsp/src/analyzer.ts` (both import lines)
- `lsp/src/handlers/hover.ts` (both import lines)
- `lsp/src/handlers/completion.ts`
- `lsp/src/utils/hover-markdown.ts`
- `app/token-playground/src/tokens.ts` (both import lines)

Do NOT touch any `dtcg-tokens-lsp` specifier and do NOT touch `const SOURCE = "dtcg-tokens"` in `lsp/src/handlers/diagnostics.ts`.

**Verify**: `grep -rn "dtcg-tokens" lsp/src app/token-playground/src | grep -v "dtcg-tokens-lsp"` → the ONLY remaining match is `lsp/src/handlers/diagnostics.ts:… const SOURCE = "dtcg-tokens";`. If any `import … "dtcg-tokens"` line remains, it is unfinished.

### Step 4: Create `LICENSE`

Write standard ISC license text to `LICENSE`:

```
ISC License

Copyright (c) 2026 Stefan Kopco

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```

**Verify**: `head -1 LICENSE` → contains `ISC`

### Step 5: Rewrite the README name references and the "Resolver" section

In `README.md`:

a. Replace the package name `dtcg-tokens` with `@oddsquad/tic-tac-token` in: the H1 title (line 1), the install snippet (`pnpm add …` / `npm install …`, lines 10–11), and the import examples (lines 17, 55, 115). Import subpaths change accordingly: `dtcg-tokens/schema.json` → `@oddsquad/tic-tac-token/schema.json`.

b. Replace the three lines of the `## Resolver` section (lines 127–129, the "out of scope" text) with a real usage section:

````markdown
## Resolver

The `@oddsquad/tic-tac-token/resolver` subpath exports the full resolution pipeline: `$extends` deep-merge, `$ref` dereferencing (token-root + nested), group-`$type` inheritance, `{alias}` resolution, and gradient position clamping.

```ts
import { resolveTokens } from "@oddsquad/tic-tac-token/resolver";

const { tokens, byPath, errors, references } = resolveTokens(parsedTokensDocument);

// tokens:     FlatToken[] — flattened, fully resolved token list
// byPath:     Map<string, FlatToken> — indexed by dot-path
// errors:     ResolverError[] — broken refs, alias cycles, $extends cycles, …
// references: Map<string, Set<string>> — reverse reference graph (who consumes each token)
```

Individual pipeline stages (`applyExtends`, `resolveRefs`, `flattenTokens`, `resolveAliases`, `clampGradients`) and `jsonPointerGet` are exported for advanced use.
````

c. If the two bullets near `README.md:124-125` describe gradient clamping / typeless tokens as validator deviations, ensure they now read as *handled by this resolver* rather than as open gaps that contradict the section above.

**Verify**: `grep -n "out of scope" README.md` → no matches; `grep -n "resolveTokens" README.md` → at least 1 match; `grep -n "dtcg-tokens" README.md` → no matches (all replaced by the scoped name).

### Step 6: Fix dead relative doc links + LSP README references

a. In `README.md`, change `./docs/dtcg-spec.md` and any remaining `./docs/roadmap.md` links to absolute URLs: `https://github.com/oddcelot/tic-tac-token/blob/main/docs/dtcg-spec.md` (same pattern for roadmap).

b. In `lsp/README.md`, update the three references to the root package name (line 5 link text, lines 99–100 the pipeline description) from `dtcg-tokens` → `@oddsquad/tic-tac-token`, and change the build command `pnpm -F dtcg-tokens build:dist` (line 107) → `pnpm -F @oddsquad/tic-tac-token build:dist`. Do NOT touch any `dtcg-tokens-lsp` reference in this file.

**Verify**: `grep -n "](./docs/" README.md` → no matches. `grep -n "dtcg-tokens" lsp/README.md | grep -v "dtcg-tokens-lsp"` → no matches (every remaining `dtcg-tokens` in that file is part of `dtcg-tokens-lsp`).

### Step 7: Delete the stale npm lockfile, reinstall, and run the full chain

```sh
git rm package-lock.json
pnpm install
pnpm test
pnpm generate-schema
pnpm build:dist
pnpm -F dtcg-tokens-lsp build:dist
pnpm -F dtcg-tokens-lsp test
npm pack --dry-run
```

**Verify**:
- `ls package-lock.json` → No such file; `ls pnpm-lock.yaml` → exists.
- `pnpm install` → exit 0 (workspace re-links `@oddsquad/tic-tac-token`).
- `pnpm test` → all root test files pass, exit 0.
- `pnpm generate-schema` → exit 0 AND `git diff --stat schema.json` shows no change (a diff means source drift — STOP).
- `pnpm build:dist` → `test -f dist/index.js && test -f dist/resolver/index.js && test -f dist/index.d.ts` → exit 0.
- `pnpm -F dtcg-tokens-lsp build:dist` → exit 0. **This is the critical rename proof** — the LSP now imports `@oddsquad/tic-tac-token` and must still resolve and typecheck. A `Cannot find module '@oddsquad/tic-tac-token'` or a lingering `dtcg-tokens` resolution error here means the rename is incomplete — STOP and report.
- `pnpm -F dtcg-tokens-lsp test` → all pass, exit 0.
- `npm pack --dry-run` → tarball contents are exactly `dist/**`, `schema.json`, `README.md`, `LICENSE`, `package.json`. If `src/`, `tests/`, or `docs/` appear, STOP.

### Step 8: Publish (GATED — operator confirmation required)

Publishing claims the `@oddsquad/tic-tac-token` name on npm permanently and cannot be undone (unpublish windows are narrow). **Do not run this step unless the operator has explicitly confirmed the publish in this session.** If no confirmation exists, stop here, report the package as publish-ready, and mark the plan `DONE (publish pending operator)` in the index.

Preconditions the operator must also have satisfied: `npm whoami` succeeds and the account is a member of the `@oddsquad` npm organization (scoped publish requires org membership or a personal scope matching the account). If `npm whoami` fails or the scope is not owned, STOP and report — do not attempt to create the org.

With confirmation: `pnpm publish --access public` from the repo root (pnpm runs `prepublishOnly` automatically).

**Verify**: `npm view @oddsquad/tic-tac-token version` → `0.1.0`

## Test plan

No new tests — this plan is rename/metadata/docs only. The gates are the existing suites plus the consumer build:
- `pnpm test` (root) → all pass.
- `pnpm -F dtcg-tokens-lsp build:dist` + `pnpm -F dtcg-tokens-lsp test` → all pass, proving consumers resolve the renamed package.

Any failure is a STOP condition.

## Done criteria

- [ ] `package.json` name is `@oddsquad/tic-tac-token` with `publishConfig.access: "public"` and all metadata fields present
- [ ] `grep -rn "dtcg-tokens" lsp/src app/token-playground/src | grep -v dtcg-tokens-lsp` → only the `diagnostics.ts` `SOURCE` label remains
- [ ] `pnpm test` exits 0
- [ ] `pnpm generate-schema` exits 0 with no `schema.json` diff
- [ ] `pnpm build:dist` exits 0; `dist/resolver/index.js` exists
- [ ] `pnpm -F dtcg-tokens-lsp build:dist` exits 0 (rename resolves for consumers)
- [ ] `pnpm -F dtcg-tokens-lsp test` exits 0
- [ ] `npm pack --dry-run` file list = dist + schema.json + README.md + LICENSE + package.json
- [ ] `grep -n "out of scope" README.md` → no matches; `grep -n "dtcg-tokens" README.md` → no matches
- [ ] `git status` shows no modifications outside the in-scope list
- [ ] `plans/README.md` status row updated (unless reviewer maintains the index)

## STOP conditions

Stop and report back (do not improvise) if:

- The drift check shows in-scope files changed since commit `221fdf6` and the excerpts no longer match.
- After the rename, `pnpm -F dtcg-tokens-lsp build:dist` fails to resolve `@oddsquad/tic-tac-token` (rename incomplete or a consumer imports the root package from a file not listed in scope — report the file).
- `pnpm test`, `pnpm generate-schema`, `pnpm build:dist`, or the LSP build/test fails twice after a reasonable environment fix attempt (e.g. wrong Node version — `.prototools` pins Node 24.2.0).
- `pnpm generate-schema` produces a non-empty `schema.json` diff.
- The tarball preview includes unexpected files and the cause isn't a missing `files` entry you just added.
- You reach Step 8 without explicit operator confirmation to publish, or `npm whoami` fails / the `@oddsquad` scope is not owned by the account.

## Maintenance notes

- After this lands, `dtcg-tokens-lsp` (plan 002) becomes publishable — its `workspace:*` dep (now keyed `@oddsquad/tic-tac-token`) can be rewritten to a real range by `pnpm publish`. **Plan 002 and its command references must be updated to the new dependency name and to `npm view @oddsquad/tic-tac-token` before it is executed** (the reviewer/advisor handles this during reconciliation).
- Open question for the operator, deferred out of this plan: whether the LSP package should also move to the `@oddsquad` scope (`@oddsquad/tic-tac-token-lsp`). If yes, that's an amendment to plan 002, not this one.
- Deferred follow-up: a CI workflow running `pnpm install --frozen-lockfile && pnpm test && pnpm generate-schema && pnpm build:dist && pnpm -F dtcg-tokens-lsp test` on push, so the prepublish chain and consumer resolution are continuously proven. Recommend adding it right after first publish.
- `sideEffects: false` assumes the arktype `type()` calls at module top level have no consumer-visible global effects — true today (scopes are module-local). Re-check if a future version introduces global scope registration.
- Version bumps: keep `schema.json` regeneration inside `prepublishOnly` (already wired) so the JSON Schema artifact can't drift from the published types.
