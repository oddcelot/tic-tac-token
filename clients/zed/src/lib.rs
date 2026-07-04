use zed_extension_api::{self as zed, settings::LspSettings, LanguageServerId, Result};

// Zed extension that registers the `dtcg-tokens-lsp` language server for
// JSON files. In production it installs `@oddsquad/tic-tac-token-lsp` from
// npm into the extension's own work directory and launches
// `node node_modules/@oddsquad/tic-tac-token-lsp/dist/server.js --stdio`.
//
// Dev escape hatch: if the open worktree IS this monorepo, the locally
// built `lsp/dist/server.js` wins over the npm install so iterating on the
// LSP doesn't require publishing first. The probe fingerprints two TRACKED
// manifests, both of which must match:
//
//   1. The worktree root `package.json` names this monorepo
//      (`"@oddsquad/tic-tac-token"`, quotes included — the quoted match
//      rules out foreign projects that merely *depend on*
//      `@oddsquad/tic-tac-token-lsp`, since that dependency string has a
//      `-lsp` suffix before the closing quote).
//   2. `lsp/package.json` names the LSP package
//      (`"@oddsquad/tic-tac-token-lsp"`). A foreign project that depends on
//      the root package has no `lsp/package.json` at its worktree root, so
//      this rules it out.
//
// Why fingerprint `lsp/package.json` and NOT the built `lsp/dist/server.js`?
// `dist/` is gitignored, and Zed's `worktree.read_text_file` reads from the
// worktree's (gitignore-respecting) snapshot — it CANNOT see gitignored
// files, so reading `lsp/dist/server.js` always failed and forced the npm
// fallback even inside the monorepo. We must gate on tracked files only.
// `std::fs` is not an option either — only the extension's own work
// directory is preopened inside the WASI sandbox (the biome Zed extension
// documents the same limitation and also probes via the worktree API).
//
// Consequence: inside the monorepo the dev must have run
// `pnpm -F @oddsquad/tic-tac-token-lsp build:dist` first. If `dist/` is
// missing, node fails fast with a clear MODULE_NOT_FOUND rather than
// silently serving a stale npm build — which is the correct signal when
// you're actively developing the server.
//
// The server is namespaced to .tokens / .tokens.json URIs at the LSP
// layer (see `lsp/src/server.ts: isTokenDocument`), so attaching it to
// the broader JSON language is safe — non-token JSON files get no
// diagnostics or hover from this server.
//
// `node_binary_path()` returns the path to Zed's managed Node runtime.
// Without it, Zed would treat the bare string "node" as a path relative
// to the extension's work directory and fail to spawn.
struct DtcgTokensExtension;

const DEV_SERVER_RELATIVE_PATH: &str = "lsp/dist/server.js";
const MONOREPO_FINGERPRINT: &str = "\"@oddsquad/tic-tac-token\"";
const LSP_MANIFEST_RELATIVE_PATH: &str = "lsp/package.json";
const LSP_PACKAGE_FINGERPRINT: &str = "\"@oddsquad/tic-tac-token-lsp\"";
const PACKAGE: &str = "@oddsquad/tic-tac-token-lsp";

fn is_this_monorepo(worktree: &zed::Worktree) -> bool {
    let root_is_monorepo = worktree
        .read_text_file("package.json")
        .is_ok_and(|content| content.contains(MONOREPO_FINGERPRINT));
    root_is_monorepo
        && worktree
            .read_text_file(LSP_MANIFEST_RELATIVE_PATH)
            .is_ok_and(|content| content.contains(LSP_PACKAGE_FINGERPRINT))
}

impl zed::Extension for DtcgTokensExtension {
    fn new() -> Self {
        Self
    }

    fn language_server_command(
        &mut self,
        _language_server_id: &LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<zed::Command> {
        let node = zed::node_binary_path()?;

        if is_this_monorepo(worktree) {
            let dev_path = format!("{}/{DEV_SERVER_RELATIVE_PATH}", worktree.root_path());
            return Ok(zed::Command {
                command: node,
                args: vec![dev_path, "--stdio".into()],
                env: vec![],
            });
        }

        let latest = zed::npm_package_latest_version(PACKAGE)?;
        if zed::npm_package_installed_version(PACKAGE)?.as_deref() != Some(latest.as_str()) {
            zed::npm_install_package(PACKAGE, &latest)?;
        }
        let cwd = std::env::current_dir()
            .map_err(|e| format!("failed to get extension working directory: {e}"))?;
        let server_path = cwd
            .join("node_modules")
            .join(PACKAGE)
            .join("dist/server.js")
            .to_string_lossy()
            .to_string();
        Ok(zed::Command {
            command: node,
            args: vec![server_path, "--stdio".into()],
            env: vec![],
        })
    }

    fn language_server_initialization_options(
        &mut self,
        _language_server_id: &LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<Option<zed::serde_json::Value>> {
        let settings = LspSettings::for_worktree("dtcg-tokens-lsp", worktree)?;
        Ok(settings.initialization_options)
    }

    fn language_server_workspace_configuration(
        &mut self,
        _language_server_id: &LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<Option<zed::serde_json::Value>> {
        let settings = LspSettings::for_worktree("dtcg-tokens-lsp", worktree)?;
        Ok(settings.settings)
    }
}

zed::register_extension!(DtcgTokensExtension);
