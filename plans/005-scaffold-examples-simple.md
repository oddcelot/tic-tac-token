# Plan 005: Scaffold `examples/simple` — a minimal external-consumer project

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **This plan builds on plan 001's rename.** It must run on top of the
> `advisor/001-publish-oddsquad-tic-tac-token` branch (or a worktree that
> already has that rename applied) — the example imports
> `@oddsquad/tic-tac-token`, which does not exist under that name on `main`
> until plan 001 merges. If you are not already on top of that rename,
> STOP and report; do not redo the rename here.
>
> **Drift check**: `git diff --stat 221fdf6..HEAD -- package.json` — expect
> the plan-001 rename diff (name `@oddsquad/tic-tac-token`, publish
> metadata). If `package.json` still says `"name": "dtcg-tokens"`, the
> rename hasn't landed in this tree — STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW — new, isolated directory; touches no existing source
- **Depends on**: plans/001-publish-dtcg-tokens.md (needs the renamed package to exist as `@oddsquad/tic-tac-token`)
- **Category**: dx / docs
- **Planned at**: commit `05f0fc6` (tip of `advisor/001-publish-oddsquad-tic-tac-token`), 2026-07-03

## Why this matters

The repo has no example of what it's like to *consume* the published package from outside the workspace — every existing user is an internal workspace member (`lsp`, `app/token-playground`) linked via `workspace:*`, which never exercises the actual `files` allowlist, `exports` map, or packed tarball contents. A bug where a needed file is missing from `files`, or an export subpath is wrong, would pass every internal check and only surface for a real npm consumer. `examples/simple` closes that gap: a standalone project (not a pnpm workspace member) that installs from the packed tarball — exactly what `npm publish` would ship — and exercises both the validator and the resolver against a small DTCG tokens file that showcases the resolver's actual value (group-`$type` inheritance, alias resolution, gradient-position clamping).

## Current state

- No `examples/` directory exists (verified: `ls examples` → no such directory).
- `pnpm-workspace.yaml` lists only `.`, `lsp`, `app/token-playground` — `examples/simple` is deliberately **not** added to this list. It must resolve the package the way an external consumer would (a real install), not via pnpm's workspace symlink, or this example would never catch a packaging bug.
- Root `package.json` (post-rename, plan 001) exports `.`, `./resolver`, `./schema.json`, and its `files` allowlist is `["dist", "schema.json", "README.md", "LICENSE"]`. See plan 001 for the exact fields — do not re-verify or re-apply that plan's changes here, just assume it's already landed in this tree.
- There is a pre-existing minimal DTCG fixture at repo-root `example.json` (a flat validator-only smoke file, no aliases/resolver features) — informative as a style reference but do not reuse it verbatim; the new example needs alias + gradient + group-type-inheritance content to demonstrate the resolver, which `example.json` doesn't have.
- Resolver behavior verified directly from source for this plan (do not re-derive, just use these facts):
  - `src/resolver/flatten.ts` — a token with no own `$type` inherits the **nearest ancestor group's** `$type` (propagated recursively via `walk(v, [...prefix, k], effectiveType)`). A token with no own `$type` AND no inherited group `$type` is dropped with a `type-mismatch` error — so a typeless alias token only works if some ancestor group declares `$type`.
  - `src/resolver/aliases.ts` — `"{group.token}"` strings (whole-string only) resolve to the target token's `$value`, transitively, with cycle detection (`alias-cycle`) and missing-target detection (`broken-alias`).
  - `src/resolver/clamp.ts` — `gradient` token `$value` stops have their `position` clamped to `[0, 1]`; out-of-range inline numbers (e.g. `-0.2`, `1.4`) get silently clamped, not rejected.
- Node/pnpm pinned via `.prototools`: `node = "24.2.0"`, `pnpm = "10.18.3"`. The example itself should run on plain Node with **no build step** (ship `.mjs`, not `.ts`) so it demonstrates the zero-friction "just works" experience of a published npm package — do not add a bundler, tsconfig, or build script to this example.
- Root `.gitignore` has an unanchored `node_modules` entry, which git matches at any depth — `examples/simple/node_modules/` is already ignored; no extra `.gitignore` is needed inside the example directory.

## Scope

**In scope** (create these; nothing else):
- `examples/simple/package.json`
- `examples/simple/tokens.json`
- `examples/simple/index.mjs`
- `examples/simple/README.md`
- `plans/README.md` (status row) — SKIP if a reviewer told you they maintain the index.

**Out of scope** (do NOT touch):
- `pnpm-workspace.yaml` — do NOT add `examples/*` to it. This example must stay outside the workspace (see "Why this matters").
- Root `package.json`, `README.md`, `src/**`, `tests/**` — no changes needed or permitted here.
- `example.json` (repo root) — leave as-is; unrelated pre-existing fixture.
- `lsp/**`, `app/**`, `clients/**`, `figma-plugin/**` — unrelated.

## Git workflow

- Branch: continue on the current branch (`advisor/001-publish-oddsquad-tic-tac-token`) as additional commit(s) — do NOT create a new branch, since this plan depends on the rename already present in this tree.
- Conventional commit: `docs(examples): scaffold examples/simple external-consumer demo`.
- Do NOT push unless the operator instructed it.

## Steps

### Step 1: Write `examples/simple/tokens.json`

A DTCG 2025.10 tokens file that exercises: group-level `$type` inheritance, alias resolution, and gradient-position clamping — the three resolver features easiest to show side-by-side.

```json
{
  "color": {
    "$type": "color",
    "brand": {
      "$value": {
        "colorSpace": "srgb",
        "components": [0.2, 0.4, 1],
        "alpha": 1,
        "hex": "#3366ff"
      }
    },
    "brand-hover": {
      "$value": "{color.brand}"
    }
  },
  "gradient": {
    "hero": {
      "$type": "gradient",
      "$value": [
        { "color": "{color.brand}", "position": -0.2 },
        { "color": "{color.brand-hover}", "position": 1.4 }
      ]
    }
  }
}
```

Notes for the executor: `color.brand` and `color.brand-hover` both inherit `$type: "color"` from the `color` group — neither declares its own `$type`. `color.brand-hover`'s `$value` is a bare alias string, resolved transitively by `resolveAliases`. `gradient.hero`'s stop positions (`-0.2`, `1.4`) are intentionally out of `[0, 1]` to demonstrate `clampGradients` — after resolution they must read `0` and `1`.

**Verify**: `node -e "JSON.parse(require('fs').readFileSync('examples/simple/tokens.json','utf8')); console.log('valid json')"` → `valid json`

### Step 2: Write `examples/simple/package.json`

```json
{
  "name": "tic-tac-token-example-simple",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "description": "Minimal external-consumer example for @oddsquad/tic-tac-token — validates and resolves a small DTCG tokens file.",
  "scripts": {
    "start": "node index.mjs"
  },
  "dependencies": {
    "@oddsquad/tic-tac-token": "^0.1.0"
  }
}
```

`"private": true` — this is a demo, never published itself. The dependency range (`^0.1.0`) documents what a real consumer would write once the package is on npm; local verification (Step 4) installs from a packed tarball instead without touching this line.

**Verify**: `node -e "const p=require('./examples/simple/package.json'); if(!p.private) throw 'private'; if(!p.dependencies['@oddsquad/tic-tac-token']) throw 'dep'; console.log('ok')"` → `ok`

### Step 3: Write `examples/simple/index.mjs`

Plain ESM, no build step. Read `tokens.json` from disk, validate with `TokensFile`, resolve with `resolveTokens`, print a short human-readable summary.

```js
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { TokensFile } from "@oddsquad/tic-tac-token";
import { resolveTokens } from "@oddsquad/tic-tac-token/resolver";

const tokensPath = fileURLToPath(new URL("./tokens.json", import.meta.url));
const doc = JSON.parse(readFileSync(tokensPath, "utf8"));

const validation = TokensFile(doc);
if (validation instanceof Array) {
  console.error("Validation failed:");
  for (const issue of validation) console.error(`  - ${issue.path}: ${issue.message}`);
  process.exit(1);
}
console.log(`Validated ${tokensPath} — structure OK.\n`);

const { tokens, errors } = resolveTokens(doc);
if (errors.length > 0) {
  console.error("Resolver errors:");
  for (const err of errors) console.error(`  - [${err.kind}] ${err.at}: ${err.message}`);
  process.exit(1);
}

console.log("Resolved tokens:");
for (const token of tokens) {
  console.log(`  ${token.path} (${token.$type}):`, JSON.stringify(token.$value));
}
```

Before writing this file, check the exact arktype validation call shape used elsewhere in the repo (e.g. `src/index.ts` or existing tests under `tests/`) — arktype `type()` validators return either the validated value or an arktype error object depending on version/usage; match whatever shape `TokensFile(...)` actually returns in this codebase rather than trusting the snippet above verbatim if it differs. Adjust the validation-failure branch accordingly and re-verify against the running example (Step 4) rather than against this snippet.

**Verify** (syntax only at this point): `node --check examples/simple/index.mjs` → exit 0

### Step 4: Write `examples/simple/README.md`

Document both the real-world path and the local pre-publish verification path:

````markdown
# examples/simple

A minimal external-consumer demo for [`@oddsquad/tic-tac-token`](../../README.md). Installs the package like any npm consumer would (not via this repo's pnpm workspace) and runs a small script that validates and resolves a DTCG tokens file.

## Run it (once the package is published)

```sh
cd examples/simple
npm install
npm start
```

## Run it locally, before publish

From the repo root:

```sh
pnpm build:dist
npm pack --pack-destination examples/simple
cd examples/simple
npm install ./oddsquad-tic-tac-token-*.tgz --no-save
npm start
rm oddsquad-tic-tac-token-*.tgz
```

`--no-save` installs from the exact tarball `npm publish` would ship (proving the `files` allowlist and `exports` map both work for a real consumer) without overwriting the `^0.1.0` dependency range committed in `package.json`.

## What it shows

- `color.brand-hover` has no `$type` of its own — it inherits `color` from the parent group.
- `color.brand-hover`'s value is the alias `"{color.brand}"`, resolved to the same value as `color.brand`.
- `gradient.hero`'s stop positions (`-0.2`, `1.4`) are out of range; the resolver clamps them to `0` and `1`.
````

**Verify**: `grep -n "npm start" examples/simple/README.md` → at least 1 match

### Step 5: End-to-end verification — install from the real tarball and run

This is the actual proof the example (and the packaging) works — run it exactly as documented in the README:

```sh
pnpm build:dist
npm pack --pack-destination examples/simple
cd examples/simple
npm install ./oddsquad-tic-tac-token-*.tgz --no-save
npm start
```

**Expected output**: no error exit; stdout includes a `Validated … — structure OK.` line, then a `Resolved tokens:` line followed by three entries (`color.brand`, `color.brand-hover`, `gradient.hero`). The two color entries must show **identical** `$value` (proving alias resolution). The `gradient.hero` entry's stop positions must read `0` and `1` (not `-0.2`/`1.4`), proving clamping ran.

Afterward: `rm -f examples/simple/oddsquad-tic-tac-token-*.tgz` and confirm `git status --porcelain examples/simple` shows no untracked tarball or `node_modules` (both should be gitignored/removed — if `node_modules` shows as untracked, the root `.gitignore`'s bare `node_modules` pattern didn't match here; STOP and report rather than committing it or adding a workaround `.gitignore` yourself).

### Step 6: Cross-link from the root README (optional, do only if trivial)

If the root `README.md` (already touched by plan 001, currently on this branch) has an obvious place for a one-line pointer (e.g. near "Quick start"), add: `See [\`examples/simple\`](./examples/simple) for a full runnable example.` Skip this step entirely rather than restructure the README — it is a nice-to-have, not a requirement, and this plan's scope does not include README edits beyond this single optional line.

## Test plan

No automated test suite entry — this is a documentation/demo artifact, not library code. The verification *is* the test: Step 5's end-to-end run against the real packed tarball is the gate. Do not add this example to `pnpm-workspace.yaml` or wire it into the root `pnpm test` — that would silently convert it back into a workspace-linked consumer and defeat its purpose (see "Why this matters").

## Done criteria

- [ ] `examples/simple/{package.json,tokens.json,index.mjs,README.md}` all exist
- [ ] `pnpm-workspace.yaml` unchanged (still exactly `.`, `lsp`, `app/token-playground`)
- [ ] Step 5's tarball-install run exits 0 and stdout shows the alias-equality and clamped-gradient results described above
- [ ] No tarball or `node_modules` left committed or untracked under `examples/simple` after cleanup
- [ ] `git status` shows no modifications outside the in-scope list
- [ ] `plans/README.md` status row updated (unless reviewer maintains the index)

## STOP conditions

Stop and report back (do not improvise) if:

- `package.json` at the repo root still says `"name": "dtcg-tokens"` (plan 001's rename isn't present in this tree).
- The drift check shows unexpected changes to `package.json` since `05f0fc6`.
- `TokensFile(doc)` in the real repo does not match the validation-result shape assumed in Step 3's snippet, and the correct shape isn't obvious from `src/index.ts` or existing tests — report the actual shape you found instead of guessing further.
- Step 5's run produces resolver errors, an uncaught exception, or the alias/clamp results don't match what's described (e.g. the two color values differ, or gradient positions aren't clamped) — this would indicate either a bad fixture or a real resolver bug, and either way it's not this plan's job to fix `src/resolver/**`.
- `node_modules` or the tarball end up tracked/untracked-and-uncleaned after Step 5's cleanup.

## Maintenance notes

- If a future resolver feature changes clamp/alias/inheritance semantics, this example's expected output (documented in Step 5) should be re-verified — it's a lightweight regression smoke test even though it isn't wired into `pnpm test`.
- If the package version bumps past `0.1.0`, update the `^0.1.0` range in `examples/simple/package.json` to match (or leave a wide caret range that already covers it).
- Once plan 001 actually publishes to npm, the "Run it (once the package is published)" README path becomes literally runnable (`npm install` with no local tarball step) — no changes needed to make that true, it already documents the real post-publish flow.
