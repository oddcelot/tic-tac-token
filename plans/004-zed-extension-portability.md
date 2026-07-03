# Plan 004: Make the Zed extension work outside this repo's worktree

> **⚠️ RECONCILIATION BANNER (2026-07-03)** — Plan 002 (v2) renames the LSP's **npm package** from `dtcg-tokens-lsp` to `@oddsquad/tic-tac-token-lsp`. The LSP's **bin command stays `dtcg-tokens-lsp`** (a separate, unchanged decision — see plan 002's banner). This matters for this plan's Rust `PACKAGE` constant and npm-install logic:
> - The Rust constant this plan introduces (referenced in prior drafts as `const PACKAGE: &str = "dtcg-tokens-lsp";`) must be the npm package to install: `const PACKAGE: &str = "@oddsquad/tic-tac-token-lsp";`.
> - Whatever Zed helper resolves/invokes the installed binary must invoke the bin command `dtcg-tokens-lsp` (unchanged) — do not assume the bin name matches the npm package name; they differ here.
> - `npm view @oddsquad/tic-tac-token-lsp version` replaces `npm view dtcg-tokens-lsp version` wherever this plan checks the registry.
> - `clients/zed/README.md`'s dev-instruction `pnpm -F dtcg-tokens-lsp build:dist` is now stale (plan 002 renamed the package `pnpm -F` filters against) — update it to `pnpm -F @oddsquad/tic-tac-token-lsp build:dist` as part of whatever step in this plan touches that README.
> - `clients/zed/extension.toml`'s `[language_servers.dtcg-tokens-lsp]` key and `id = "dtcg-tokens"` are Zed-local identifiers, not npm references — leave them as-is unless this plan has an independent reason to change them.
>
> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 221fdf6..HEAD -- clients/zed`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED (distribution-model change; runtime verification is partly manual)
- **Depends on**: plans/002-publish-dtcg-tokens-lsp.md (`dtcg-tokens-lsp` must exist on npm)
- **Category**: dx / direction
- **Planned at**: commit `221fdf6`, 2026-07-03

## Why this matters

The Zed extension currently launches the language server from a path **inside whatever project the user has open**: `format!("{}/lsp/dist/server.js", worktree.root_path())`. That only resolves when the open folder is this monorepo itself. The actual audience for a design-tokens LSP is people editing `.tokens.json` in *their own* repos — for them the extension can never find the server. Once `dtcg-tokens-lsp` is on npm (plan 002), the extension should install/locate the server from the npm package in the extension's own work directory, the standard pattern Zed extensions use for Node-based language servers.

## Current state

- `clients/zed/src/lib.rs` (38 lines total) — the whole extension. The load-bearing function:

  ```rust
  // clients/zed/src/lib.rs:23-35
  fn language_server_command(
      &mut self,
      _language_server_id: &LanguageServerId,
      worktree: &zed::Worktree,
  ) -> Result<zed::Command> {
      let node = zed::node_binary_path()?;
      let server_path = format!("{}/lsp/dist/server.js", worktree.root_path());
      Ok(zed::Command {
          command: node,
          args: vec![server_path, "--stdio".into()],
          env: vec![],
      })
  }
  ```

  The file's own header comment documents this as a dev-only assumption ("The user must run `pnpm -F dtcg-tokens-lsp build:dist` … before opening Zed"). `zed::node_binary_path()` (Zed's managed Node) is already used correctly — keep it.
- `clients/zed/README.md` already acknowledges the gap: it calls this a "dev extension" and says publishing would need a self-contained server.
- `clients/zed/Cargo.toml` declares the `zed_extension_api` dependency — check its version before writing code; the npm-helper API surface differs across versions.
- The server is namespaced to `.tokens` / `.tokens.json` URIs at the LSP layer (`lsp/src/server.ts`'s `isTokenDocument` filtering), so attaching to the broad JSON language remains safe — do not change that design.
- Target pattern: `zed_extension_api` exposes npm helpers used by mainstream Node-LSP extensions — check the installed version's docs for the exact names, expected to be `zed::npm_package_installed_version(name)`, `zed::npm_install_package(name, version)`, and `zed::npm_package_latest_version(name)`. Packages install into the extension's own work directory (the process CWD for the extension), so the server lands at `node_modules/dtcg-tokens-lsp/dist/server.js` relative to that directory.
- Build toolchain: Rust + `wasm32-wasip1` target; build with `cargo build --target wasm32-wasip1 --release` from `clients/zed/`. The built `extension.wasm` is gitignored.
- Repo conventions: conventional commits (`feat(zed): …`, `chore(zed): …`).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Target check | `rustup target list --installed \| grep wasm32-wasip1` | present (else `rustup target add wasm32-wasip1`) |
| Build | `cd clients/zed && cargo build --target wasm32-wasip1 --release` | exit 0, `target/wasm32-wasip1/release/*.wasm` produced |
| Registry check | `npm view dtcg-tokens-lsp version` | a version string (dependency gate) |

## Scope

**In scope** (the only files you should modify):
- `clients/zed/src/lib.rs`
- `clients/zed/README.md`
- `clients/zed/Cargo.toml` (only if the `zed_extension_api` version must be bumped for the npm helpers)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch, even though they look related):
- `lsp/**` — the server itself is fine; distribution is the problem.
- `clients/zed/extension.toml` language-server/JSON wiring — the JSON-language attachment strategy stays as-is.
- Publishing to the Zed extension marketplace — separate decision after this works as a dev extension for foreign projects.

## Git workflow

- Branch: `advisor/004-zed-extension-portability`
- Conventional commits, e.g. `feat(zed): resolve server from published npm package`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Confirm the dependency gate and API surface

`npm view dtcg-tokens-lsp version` must return a version (plan 002 shipped). Then open the `zed_extension_api` docs/source for the version pinned in `clients/zed/Cargo.toml` and confirm the npm helper function names and signatures. If the pinned version lacks them, bump the crate to the nearest version that has them.

**Verify**: the three npm helper functions exist in the crate docs for the version you'll compile against (cite them in your report).

### Step 2: Rewrite `language_server_command` to install-or-reuse the npm package

Target shape (adjust to the actual API of your crate version):

```rust
fn language_server_command(
    &mut self,
    _language_server_id: &LanguageServerId,
    worktree: &zed::Worktree,
) -> Result<zed::Command> {
    let node = zed::node_binary_path()?;

    // Dev escape hatch: a locally built server in the open worktree wins,
    // so hacking on this monorepo keeps working without npm round-trips.
    let dev_path = format!("{}/lsp/dist/server.js", worktree.root_path());
    if std::fs::metadata(&dev_path).is_ok() {
        return Ok(zed::Command { command: node, args: vec![dev_path, "--stdio".into()], env: vec![] });
    }

    const PACKAGE: &str = "dtcg-tokens-lsp";
    let latest = zed::npm_package_latest_version(PACKAGE)?;
    if zed::npm_package_installed_version(PACKAGE)?.as_deref() != Some(latest.as_str()) {
        zed::npm_install_package(PACKAGE, &latest)?;
    }
    let server_path = format!("node_modules/{PACKAGE}/dist/server.js", );
    Ok(zed::Command { command: node, args: vec![server_path, "--stdio".into()], env: vec![] })
}
```

Notes: keep the explanatory header comment at the top of `lib.rs`, updating the launch description; whether relative `node_modules/...` resolves against the extension work dir is version-dependent — if the API offers an absolute-path helper for the extension dir, prefer it. `std::fs` availability under the WASI extension sandbox for the dev-path probe: if `std::fs::metadata` is not permitted, drop the dev escape hatch rather than fighting the sandbox, and note it in the report.

**Verify**: `cargo build --target wasm32-wasip1 --release` → exit 0.

### Step 3: Update `clients/zed/README.md`

Replace the "dev extension only / must build the LSP first" caveats with the new model: the extension fetches `dtcg-tokens-lsp` from npm automatically; a locally built `lsp/dist/server.js` in the open worktree takes precedence for development (if the escape hatch survived Step 2).

**Verify**: `grep -n "pnpm -F dtcg-tokens-lsp build:dist" clients/zed/README.md` → matches only in a clearly-labeled "developing this extension" section, not in user install steps.

### Step 4: Manual runtime verification (report, don't improvise)

This step needs a human-driven Zed instance and cannot be fully machine-verified. Do what's possible: install the dev extension (`zed: install dev extension` → `clients/zed/`), open a scratch project **outside** this repo containing a `.tokens.json` file with a deliberate error (e.g. `{"a":{"$type":"color","$value":42}}`), and check the Zed LSP logs show `dtcg-tokens-lsp` starting and a diagnostic appearing. If you cannot drive Zed in this environment, mark the plan `DONE (manual verification pending)` in the index and list exactly this check for the operator.

## Test plan

No Rust unit tests exist in the extension and none are required — the logic is one function of glue. The gates are: compiles for `wasm32-wasip1` (Step 2) and the manual foreign-project check (Step 4).

## Done criteria

- [ ] `cargo build --target wasm32-wasip1 --release` exits 0
- [ ] `grep -n "worktree.root_path()" clients/zed/src/lib.rs` → appears only in the dev-escape-hatch branch (or not at all if the hatch was dropped)
- [ ] README no longer instructs end users to build the LSP manually
- [ ] `git status` shows no modifications outside the in-scope list
- [ ] `plans/README.md` status row updated (with "manual verification pending" if Step 4 couldn't run)

## STOP conditions

Stop and report back (do not improvise) if:

- `npm view dtcg-tokens-lsp version` 404s (plan 002 not shipped).
- The pinned `zed_extension_api` lacks npm helpers AND bumping it introduces breaking trait changes beyond `language_server_command` — report the delta instead of refactoring the extension wholesale.
- The relative `node_modules/...` path demonstrably doesn't resolve at runtime and no documented absolute-path API exists in the crate version — this needs a design decision (download tarball manually? bundle?), not improvisation.

## Maintenance notes

- Version skew: the extension installs the *latest* npm version on each check. If a future `dtcg-tokens-lsp` release changes LSP behavior, every extension user gets it silently — consider pinning a compatible range once the package stabilizes.
- Marketplace publishing (deferred): once this works for foreign projects, the remaining lift for the Zed marketplace is repo/manifest metadata and review submission — the self-contained-server blocker this plan removes was the hard part.
- Reviewer focus: the fallback ordering (dev path before npm) — make sure a stale local build in *someone else's* repo can't shadow the npm install (the dev path only exists in this monorepo's layout, which is why the probe is acceptable).
