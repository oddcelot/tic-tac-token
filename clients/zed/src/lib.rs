use zed_extension_api::{self as zed, settings::LspSettings, LanguageServerId, Result};

// Zed extension that registers the `dtcg-tokens-lsp` language server for
// JSON files. In production it installs `@oddsquad/tic-tac-token-lsp` from
// npm into the extension's own work directory and launches
// `node node_modules/@oddsquad/tic-tac-token-lsp/dist/server.js --stdio`.
//
// Dev escape hatch: if the open worktree IS this monorepo and has a locally
// built `lsp/dist/server.js`, that build wins over the npm install so
// iterating on the LSP doesn't require publishing first. The probe is
// deliberately two gates, both of which must hold:
//
//   1. The worktree root `package.json` names this monorepo
//      (`"@oddsquad/tic-tac-token"`, quotes included — the quoted match
//      also rules out foreign projects that merely *depend on*
//      `@oddsquad/tic-tac-token-lsp`).
//   2. `lsp/dist/server.js` reads back with non-empty content.
//
// Why not a plain existence check? `worktree.read_text_file(path).is_ok()`
// was observed returning Ok at runtime for a file that does not exist
// (foreign project without any `lsp/` directory), which sent a nonexistent
// path to node (MODULE_NOT_FOUND) and blocked the npm fallback. So the
// gate must validate *content*, not just Ok-ness: gate 1 fingerprints the
// monorepo by matching what was read, gate 2 requires non-empty bytes.
// `std::fs` is not an option either — only the extension's own work
// directory is preopened inside the WASI sandbox (the biome Zed extension
// documents the same limitation and also probes via the worktree API).
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
const PACKAGE: &str = "@oddsquad/tic-tac-token-lsp";

fn is_this_monorepo_with_built_server(worktree: &zed::Worktree) -> bool {
    let is_monorepo = worktree
        .read_text_file("package.json")
        .is_ok_and(|content| content.contains(MONOREPO_FINGERPRINT));
    is_monorepo
        && worktree
            .read_text_file(DEV_SERVER_RELATIVE_PATH)
            .is_ok_and(|content| !content.is_empty())
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

        if is_this_monorepo_with_built_server(worktree) {
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
