# Plan 006: Scope root `vitest` to `tests/**` so `pnpm test` doesn't run the LSP suite

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3a10287..HEAD -- package.json tests/ lsp/tests/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P0 — actively blocks publishing
- **Effort**: XS
- **Risk**: LOW — adds one new config file, changes no source or test content
- **Depends on**: none (independent of the rename; this bug predates and is unrelated to plan 001's naming change)
- **Category**: bug / build tooling
- **Planned at**: commit `3a10287` (root of `main` after merging plans 001 + 005), 2026-07-03

## Why this matters

Running the real, unmodified `pnpm publish --access public` for the first time (previous verification passes in this session all manually ran `pnpm build:dist` *before* checking `pnpm test`, which incidentally papered over this bug) surfaced a genuine failure: `prepublishOnly` is `"pnpm test && pnpm generate-schema && pnpm build:dist"` — it runs tests *before* building anything. That's normally fine, because this package's own tests (`tests/**/*.test.ts`) import from `../src` relatively and need no build step.

The actual bug: there is **no `vitest.config.*` anywhere in the repo**, so `vitest run` (the root `test` script) defaults to globbing test files across the **entire repository**, not just this package's `tests/` directory. That includes `lsp/tests/**` — a different pnpm workspace member's test suite. Those LSP tests import the root package by its published name (`@oddsquad/tic-tac-token`) and the integration suite spawns a *built* `lsp/dist/server.js`. Neither `dist/` (root) nor `lsp/dist/` exist yet when `prepublishOnly` runs `test` first — so 5 of the 28 test files vitest picks up fail: 4 suites fail outright with "Failed to resolve entry for package '@oddsquad/tic-tac-token'" (module resolution needs `dist/index.js`, which doesn't exist), and the integration suite's 4 tests time out (its `beforeEach`/`afterEach` try to spawn `lsp/dist/server.js`, which also doesn't exist).

This has nothing to do with the rename in plan 001 — it would have failed identically under the old name `dtcg-tokens`. It was never caught because nobody had run the literal `pnpm publish` from a truly fresh state until now: verified live on 2026-07-03 — `pnpm publish --access public` stopped at the `prepublishOnly` gate with `Test Files 5 failed | 23 passed (28)`, and npm still returns 404 for the package (nothing was published; this is safe, not a rollback situation).

## Current state

- No `vitest.config.ts`, `vitest.config.js`, `vitest.config.mjs`, or a `test` key in `package.json` exists anywhere in the repo (verified: `find . -maxdepth 2 -iname "vitest.config*"` → empty, excluding `node_modules`).
- Root `package.json:35` — `"test": "vitest run"`.
- Root `tests/` contains exactly 23 `*.test.ts` files plus one non-test helper, `tests/helpers.ts` (verified: `find tests -type f ! -name "*.test.ts"` → only `helpers.ts`).
- Root `tsconfig.json:22` already scopes itself correctly: `"include": ["src/**/*", "tests/**/*", "generate-schema.ts"]` — vitest should mirror this convention, scoped to test files only.
- `src/**` contains zero `*.test.ts` files (verified: `find src -name "*.test.ts"` → empty) — all tests live under `tests/`, none colocated.
- `lsp/tests/` is a separate workspace member's test suite (`analyzer.test.ts`, `completion.test.ts`, `diagnostics.test.ts`, `hover.test.ts`, `integration.test.ts`), already run independently via `pnpm -F dtcg-tokens-lsp test` — it does not need or want to also run as part of the root package's `pnpm test`.
- Live failure captured 2026-07-03 running `pnpm publish --access public` from a fresh `pnpm install` (no `dist/` built anywhere yet):
  ```
  ❯ lsp/tests/analyzer.test.ts (0 test)      — FAIL: Failed to resolve entry for package "@oddsquad/tic-tac-token"
  ❯ lsp/tests/completion.test.ts (0 test)    — FAIL: same
  ❯ lsp/tests/diagnostics.test.ts (0 test)   — FAIL: same
  ❯ lsp/tests/hover.test.ts (0 test)         — FAIL: same
  ❯ lsp/tests/integration.test.ts (4 failed) — all 4 tests time out (spawns lsp/dist/server.js, doesn't exist)
   Test Files  5 failed | 23 passed (28)
        Tests  4 failed | 245 passed (249)
  ```
  The 23 passing files are exactly this package's own `tests/**` suite — confirming they need no build step and the fix is purely about **excluding** `lsp/tests/**` from the root's `vitest run`, not about reordering `prepublishOnly` or building anything first.

## Scope

**In scope** (the only files you should create/modify):
- `vitest.config.ts` (repo root, new file)

**Out of scope** (do NOT touch, even though they look related):
- `package.json` `scripts` — do NOT reorder `prepublishOnly` (`test && generate-schema && build:dist`). Once vitest is correctly scoped, this order is already correct and needs no change — root tests need no build step.
- `lsp/**` — do not add a vitest config there, do not modify `lsp/tests/**`, do not change how `pnpm -F dtcg-tokens-lsp test` runs. That suite is fine on its own; the bug is only that the *root* script also (incorrectly) picks it up.
- `tests/**`, `src/**` — no test or source content changes.
- `tsconfig.json` — already correctly scoped; not part of this bug.

## Git workflow

- Branch: `advisor/006-scope-root-vitest`
- Conventional commit: `fix(build): scope root vitest to tests/ so pnpm test doesn't run the LSP suite`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add `vitest.config.ts`

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
```

This mirrors `tsconfig.json`'s own `tests/**/*` scoping. No other config keys are needed — vitest's default excludes (`node_modules`, etc.) already apply on top of this `include`.

**Verify**: `test -f vitest.config.ts && echo exists`

### Step 2: Run root tests in isolation and confirm scope

```sh
pnpm test
```

**Expected**: exit 0, exactly 23 test files run (not 28), zero reference to `lsp/tests/` in the output, no failures. If the count differs from 23, investigate whether a `tests/**/*.test.ts` file was added/removed since this plan was written (check `find tests -name "*.test.ts" | wc -l` against the file's live count) rather than assuming the config is wrong.

**Verify**: `pnpm test 2>&1 | grep -c "lsp/tests"` → `0`; `pnpm test` exit code → `0`

### Step 3: Confirm the LSP's own test script is unaffected

```sh
pnpm -F dtcg-tokens-lsp build:dist
pnpm -F dtcg-tokens-lsp test
```

**Verify**: exit 0, same pass count as before this change (31 tests per the most recent full run in this session) — this proves the fix only removed the *root* script's accidental cross-package reach, without breaking the LSP's own independently-invoked suite.

### Step 4: Run the actual `prepublishOnly` chain standalone (without publishing)

```sh
pnpm test && pnpm generate-schema && pnpm build:dist
```

**Verify**: exit 0 for all three; `git diff --stat schema.json` empty (no drift); `dist/index.js` and `dist/resolver/index.js` exist. This is the exact sequence `pnpm publish` runs automatically — proving it now succeeds end-to-end is the real fix confirmation. Do NOT run `pnpm publish` itself — that step is gated to the operator, same as plan 001.

## Test plan

No new test files — this is a test-runner configuration fix. The existing 23-file root suite and the LSP's 5-file suite are the regression gates; both must pass (Steps 2–3). Step 4 is the true acceptance test: it's the literal command sequence `pnpm publish` runs internally.

## Done criteria

- [ ] `vitest.config.ts` exists at repo root with `test.include: ["tests/**/*.test.ts"]`
- [ ] `pnpm test` exits 0, runs exactly the root `tests/**` files, zero `lsp/tests` output
- [ ] `pnpm -F dtcg-tokens-lsp test` still exits 0 (unaffected)
- [ ] `pnpm test && pnpm generate-schema && pnpm build:dist` (the literal `prepublishOnly` sequence) exits 0 end-to-end
- [ ] `git status` shows no modifications outside `vitest.config.ts`

## STOP conditions

Stop and report back (do not improvise) if:

- The drift check shows `tests/` or `lsp/tests/` changed since commit `3a10287` in a way that contradicts this plan's file counts.
- After adding `vitest.config.ts`, `pnpm test` still picks up any `lsp/tests/*` file — the include glob isn't taking effect (check for a competing config source, e.g. a `test` key already present in `package.json` that vitest might prefer, or a vitest workspace file you haven't found yet).
- Any of the 23 root test files newly fail after this change (would indicate the include glob is wrong, not just under-scoped).
- The full `prepublishOnly` sequence (Step 4) still fails after this fix — report the new failure verbatim rather than attempting further fixes; that would be a different, deeper issue outside this plan's diagnosis.

## Maintenance notes

- If root tests are ever colocated next to source (`src/**/*.test.ts`), update the `include` glob to add that pattern — today there are none, so it's intentionally omitted rather than pre-added speculatively.
- Any future workspace member added under this repo should get its own `vitest.config.ts` (or equivalent scoping) rather than relying on the root's — vitest's repo-wide default glob will otherwise silently pick it up again, exactly as it did here.
