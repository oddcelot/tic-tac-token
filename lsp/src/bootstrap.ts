import { TextDocument } from "vscode-languageserver-textdocument";
import {
  type Connection,
  TextDocuments,
  TextDocumentSyncKind,
} from "vscode-languageserver";
import { analyze } from "./analyzer.ts";
import { completionsAt } from "./handlers/completion.ts";
import { diagnosticsFromAnalysis } from "./handlers/diagnostics.ts";
import { hoverAt } from "./handlers/hover.ts";

// Transport-neutral server bootstrap. Both the Node stdio entry
// (server.ts) and the browser Worker entry (server-browser.ts) call
// this with a Connection wired to the appropriate transport. All
// handler logic and document/analysis state live here so the two
// platforms share one code path.
export function registerServer(connection: Connection): void {
  const documents = new TextDocuments(TextDocument);

  // Cache the latest analysis per document URI. Re-analysis happens on
  // open and on (debounced) change.
  const analyses = new Map<string, Awaited<ReturnType<typeof analyze>>>();
  const pending = new Map<string, ReturnType<typeof setTimeout>>();
  const DEBOUNCE_MS = 150;

  // The server is registered against `JSON` in editors that lack a
  // dedicated DTCG language, so it sees every JSON file the user opens.
  // Filter to the DTCG-conventional extensions only — anything else
  // returns empty diagnostics and no hover, leaving the document
  // untouched.
  function isTokenDocument(uri: string): boolean {
    return /\.tokens(\.json)?($|\?|#)/.test(uri);
  }

  async function refresh(uri: string, text: string): Promise<void> {
    if (!isTokenDocument(uri)) return;
    const analysis = await analyze(text);
    analyses.set(uri, analysis);
    const diagnostics = diagnosticsFromAnalysis(analysis);
    await connection.sendDiagnostics({ uri, diagnostics });
  }

  function scheduleRefresh(uri: string, text: string): void {
    if (!isTokenDocument(uri)) return;
    const existing = pending.get(uri);
    if (existing) clearTimeout(existing);
    const timeout = setTimeout(() => {
      pending.delete(uri);
      void refresh(uri, text);
    }, DEBOUNCE_MS);
    pending.set(uri, timeout);
  }

  connection.onInitialize(() => ({
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      hoverProvider: true,
      completionProvider: {
        triggerCharacters: ["{", "."],
      },
    },
    serverInfo: { name: "dtcg-tokens-lsp", version: "0.1.0" },
  }));

  documents.onDidOpen((event) => {
    void refresh(event.document.uri, event.document.getText());
  });

  documents.onDidChangeContent((event) => {
    scheduleRefresh(event.document.uri, event.document.getText());
  });

  documents.onDidClose((event) => {
    analyses.delete(event.document.uri);
    const existing = pending.get(event.document.uri);
    if (existing) {
      clearTimeout(existing);
      pending.delete(event.document.uri);
    }
    void connection.sendDiagnostics({
      uri: event.document.uri,
      diagnostics: [],
    });
  });

  connection.onHover(async (params) => {
    if (!isTokenDocument(params.textDocument.uri)) return null;
    const analysis = await ensureAnalysis(params.textDocument.uri);
    if (!analysis) return null;
    return hoverAt(analysis, params.position) ?? null;
  });

  connection.onCompletion(async (params) => {
    if (!isTokenDocument(params.textDocument.uri)) return null;
    const analysis = await ensureAnalysis(params.textDocument.uri);
    if (!analysis) return null;
    return completionsAt(analysis, params.position);
  });

  async function ensureAnalysis(
    uri: string,
  ): Promise<Awaited<ReturnType<typeof analyze>> | undefined> {
    let analysis = analyses.get(uri);
    if (!analysis) {
      const doc = documents.get(uri);
      if (!doc) return undefined;
      analysis = await analyze(doc.getText());
      analyses.set(uri, analysis);
    }
    return analysis;
  }

  documents.listen(connection);
}
