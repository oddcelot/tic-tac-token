use zed_extension_api::{self as zed, LanguageServerId, Result};

// Zed dev extension that registers `dtcg-tokens-lsp` as a language
// server for JSON files. Launches `node <worktree>/lsp/dist/server.js
// --stdio`. The user must run `pnpm -F dtcg-tokens-lsp build:dist` to
// produce the server binary before opening Zed.
//
// The server is namespaced to .tokens / .tokens.json URIs at the LSP
// layer (see `lsp/src/server.ts: isTokenDocument`), so attaching it to
// the broader JSON language is safe — non-token JSON files get no
// diagnostics or hover from this server.
struct DtcgTokensExtension;

impl zed::Extension for DtcgTokensExtension {
    fn new() -> Self {
        Self
    }

    fn language_server_command(
        &mut self,
        _language_server_id: &LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<zed::Command> {
        let server_path = format!("{}/lsp/dist/server.js", worktree.root_path());
        Ok(zed::Command {
            command: "node".into(),
            args: vec![server_path, "--stdio".into()],
            env: vec![],
        })
    }
}

zed::register_extension!(DtcgTokensExtension);
