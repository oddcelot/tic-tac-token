use zed_extension_api::{self as zed, LanguageServerId, Result};

// Zed extension that registers the `dtcg-tokens-lsp` language server for
// JSON files. In production it installs `@oddsquad/tic-tac-token-lsp` from
// npm into the extension's own work directory and launches
// `node node_modules/@oddsquad/tic-tac-token-lsp/dist/server.js --stdio`.
//
// Dev escape hatch: if the open worktree has a locally built
// `lsp/dist/server.js` (i.e. you're hacking on this monorepo), that build
// wins over the npm install so iterating on the LSP doesn't require
// publishing first. Existence is probed via `worktree.read_text_file`
// rather than `std::fs`, since only the extension's own work directory is
// preopened inside the WASI sandbox — arbitrary worktree paths are not
// reliably reachable through `std::fs` (see e.g. the biome Zed extension,
// which hits the same limitation and works around it by reading
// `package.json` through the worktree API instead of `std::fs`).
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
const PACKAGE: &str = "@oddsquad/tic-tac-token-lsp";

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

        if worktree.read_text_file(DEV_SERVER_RELATIVE_PATH).is_ok() {
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
        let server_path = format!("node_modules/{PACKAGE}/dist/server.js");
        Ok(zed::Command {
            command: node,
            args: vec![server_path, "--stdio".into()],
            env: vec![],
        })
    }
}

zed::register_extension!(DtcgTokensExtension);
