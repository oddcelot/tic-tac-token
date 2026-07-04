import { TextDocument } from "vscode-languageserver-textdocument";
import {
  type Connection,
  DidChangeWatchedFilesNotification,
  FileChangeType,
  type InitializeParams,
  TextDocuments,
  TextDocumentSyncKind,
} from "vscode-languageserver";
import { analyze } from "./analyzer.ts";
import { completionsAt } from "./handlers/completion.ts";
import { diagnosticsFromAnalysis } from "./handlers/diagnostics.ts";
import { documentColors, colorPresentations } from "./handlers/document-color.ts";
import { hoverAt } from "./handlers/hover.ts";
import {
  semanticTokensFull,
  semanticTokensLegend,
} from "./handlers/semantic-tokens.ts";
import {
  DEFAULT_SCAN_OPTIONS,
  type ScanOptions,
  type WorkspaceHost,
} from "./workspace/host.ts";
import { WorkspaceIndex } from "./workspace/index.ts";

// Transport-neutral server bootstrap. Both the Node stdio entry
// (server.ts) and the browser Worker entry (server-browser.ts) call
// this with a Connection wired to the appropriate transport. All
// handler logic and document/analysis state live here so the two
// platforms share one code path.
export function registerServer(
  connection: Connection,
  options: { workspaceHost?: WorkspaceHost } = {},
): void {
  const documents = new TextDocuments(TextDocument);
  const workspaceHost = options.workspaceHost;

  // Cache the latest analysis per document URI. Re-analysis happens on
  // open and on (debounced) change.
  const analyses = new Map<string, Awaited<ReturnType<typeof analyze>>>();
  const pending = new Map<string, ReturnType<typeof setTimeout>>();
  const DEBOUNCE_MS = 150;

  // Workspace-wide token index: every analyzed `.tokens(.json)` document,
  // whether open in the editor or discovered on disk by the workspace
  // host. Lets aliases/`$ref`s resolve across files. In the browser
  // transport `workspaceHost` is undefined, so the index only ever holds
  // open documents.
  const index = new WorkspaceIndex();
  let rootUris: string[] = [];
  let scanOptions: ScanOptions = DEFAULT_SCAN_OPTIONS;
  let supportsWatchedFiles = false;

  // A dot-path resolves somewhere in the workspace (used to soften
  // "broken locally" signals when another file defines the target).
  function resolvesInWorkspace(path: string, excludeUri?: string): boolean {
    return index.lookup(path, excludeUri).length > 0;
  }

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
    index.upsert(uri, analysis);
    const diagnostics = diagnosticsFromAnalysis(analysis, (path) =>
      resolvesInWorkspace(path, uri),
    );
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

  connection.onInitialize((params: InitializeParams) => {
    rootUris = workspaceRootUris(params);
    scanOptions = mergeScanOptions(params.initializationOptions);
    supportsWatchedFiles = Boolean(
      params.capabilities.workspace?.didChangeWatchedFiles?.dynamicRegistration,
    );
    return {
      capabilities: {
        textDocumentSync: TextDocumentSyncKind.Incremental,
        hoverProvider: true,
        completionProvider: {
          triggerCharacters: ["{", ".", "#", "/", '"'],
        },
        colorProvider: true,
        semanticTokensProvider: {
          legend: semanticTokensLegend,
          full: true,
          range: false,
        },
      },
      serverInfo: { name: "dtcg-tokens-lsp", version: "0.1.0" },
    };
  });

  connection.onInitialized(() => {
    if (!workspaceHost || rootUris.length === 0) return;
    // Fire-and-forget: seed the index from disk without blocking init.
    void seedWorkspace();
    if (supportsWatchedFiles) {
      void connection.client.register(DidChangeWatchedFilesNotification.type, {
        watchers: [
          { globPattern: "**/*.tokens" },
          { globPattern: "**/*.tokens.json" },
        ],
      });
    }
  });

  async function seedWorkspace(): Promise<void> {
    if (!workspaceHost) return;
    try {
      const files = await workspaceHost.scan(rootUris, scanOptions);
      for (const file of files) {
        // Open documents win — they carry unsaved edits.
        if (documents.get(file.uri) || analyses.has(file.uri)) continue;
        if (!isTokenDocument(file.uri)) continue;
        index.upsert(file.uri, await analyze(file.text));
      }
    } catch {
      // A failed scan just means no cross-file resolution; never fatal.
    }
  }

  connection.onDidChangeWatchedFiles(async (params) => {
    if (!workspaceHost) return;
    for (const change of params.changes) {
      if (!isTokenDocument(change.uri)) continue;
      // Open documents are managed by the text-sync events, not the watcher.
      if (documents.get(change.uri)) continue;
      if (change.type === FileChangeType.Deleted) {
        index.remove(change.uri);
        continue;
      }
      const text = await workspaceHost.read(change.uri);
      if (text !== undefined) index.upsert(change.uri, await analyze(text));
    }
  });

  documents.onDidOpen((event) => {
    void refresh(event.document.uri, event.document.getText());
  });

  documents.onDidChangeContent((event) => {
    scheduleRefresh(event.document.uri, event.document.getText());
  });

  documents.onDidClose((event) => {
    const uri = event.document.uri;
    analyses.delete(uri);
    const existing = pending.get(uri);
    if (existing) {
      clearTimeout(existing);
      pending.delete(uri);
    }
    // Keep the index entry when a workspace host is present — the file
    // still exists on disk and other documents may reference it. Re-read
    // it so the index reflects the last saved content rather than unsaved
    // edits. With no host (browser), drop it: the index only holds open
    // documents there.
    if (workspaceHost) {
      void workspaceHost.read(uri).then(async (text) => {
        // The read/analyze is async — if the document was reopened
        // meanwhile, its live analysis is authoritative; don't overwrite
        // it with the (possibly stale) saved content we just read.
        if (documents.get(uri) || analyses.has(uri)) return;
        if (text === undefined) {
          index.remove(uri);
          return;
        }
        const analysis = await analyze(text);
        if (documents.get(uri) || analyses.has(uri)) return;
        index.upsert(uri, analysis);
      });
    } else {
      index.remove(uri);
    }
    void connection.sendDiagnostics({ uri, diagnostics: [] });
  });

  connection.onHover(async (params) => {
    const uri = params.textDocument.uri;
    if (!isTokenDocument(uri)) return null;
    const analysis = await ensureAnalysis(uri);
    if (!analysis) return null;
    return hoverAt(analysis, params.position, index, uri) ?? null;
  });

  connection.onCompletion(async (params) => {
    const uri = params.textDocument.uri;
    if (!isTokenDocument(uri)) return null;
    const analysis = await ensureAnalysis(uri);
    if (!analysis) return null;
    return completionsAt(analysis, params.position, index, uri);
  });

  connection.languages.semanticTokens.on(async (params) => {
    const uri = params.textDocument.uri;
    if (!isTokenDocument(uri)) return { data: [] };
    const analysis = await ensureAnalysis(uri);
    if (!analysis) return { data: [] };
    return semanticTokensFull(analysis, (path) => resolvesInWorkspace(path, uri));
  });

  connection.onDocumentColor(async (params) => {
    const uri = params.textDocument.uri;
    if (!isTokenDocument(uri)) return [];
    const analysis = await ensureAnalysis(uri);
    if (!analysis) return [];
    return documentColors(analysis, index, uri);
  });

  connection.onColorPresentation((params) => colorPresentations(params.color));

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

// Collect workspace root URIs from the initialize params, preferring the
// (multi-root) `workspaceFolders` and falling back to the legacy
// `rootUri`.
function workspaceRootUris(params: InitializeParams): string[] {
  if (params.workspaceFolders && params.workspaceFolders.length > 0) {
    return params.workspaceFolders.map((folder) => folder.uri);
  }
  return params.rootUri ? [params.rootUri] : [];
}

// Merge user-supplied `initializationOptions.tokenFiles` over the scan
// defaults. `exclude` adds directory names to the skip list; `maxFiles`
// overrides the cap. Unknown/malformed shapes are ignored.
function mergeScanOptions(initializationOptions: unknown): ScanOptions {
  const opts = { ...DEFAULT_SCAN_OPTIONS };
  const tokenFiles =
    initializationOptions &&
    typeof initializationOptions === "object" &&
    "tokenFiles" in initializationOptions
      ? (initializationOptions as { tokenFiles?: unknown }).tokenFiles
      : undefined;
  if (tokenFiles && typeof tokenFiles === "object") {
    const tf = tokenFiles as { exclude?: unknown; maxFiles?: unknown };
    if (Array.isArray(tf.exclude)) {
      const extra = tf.exclude.filter((e): e is string => typeof e === "string");
      opts.excludeDirs = [...opts.excludeDirs, ...extra];
    }
    if (typeof tf.maxFiles === "number" && tf.maxFiles > 0) {
      opts.maxFiles = tf.maxFiles;
    }
  }
  return opts;
}
