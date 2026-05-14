import * as monaco from "monaco-editor";
import {
  BrowserMessageReader,
  BrowserMessageWriter,
  createMessageConnection,
  type MessageConnection,
} from "vscode-jsonrpc/browser";
import type {
  Diagnostic,
  Hover,
  PublishDiagnosticsParams,
  Range as LspRange,
  ServerCapabilities,
} from "vscode-languageserver-protocol";
import LspWorker from "./worker?worker";

// Minimal LSP client + Monaco bridge for the playground. Speaks
// LSP/JSON-RPC over postMessage to the in-page Worker that runs the
// dtcg-tokens-lsp browser entry. v0 features: diagnostics + hover.
// No `monaco-languageclient` dep — that pulls in a vscode shim layer
// we don't need yet.

export type LspClient = {
  init(): Promise<void>;
  didOpen(uri: string, languageId: string, text: string): void;
  didChange(uri: string, version: number, text: string): void;
  didClose(uri: string): void;
  hover(uri: string, line: number, character: number): Promise<Hover | null>;
  onDiagnostics(handler: (params: PublishDiagnosticsParams) => void): () => void;
  dispose(): void;
};

export function createLspClient(): LspClient {
  const worker = new LspWorker();
  const reader = new BrowserMessageReader(worker);
  const writer = new BrowserMessageWriter(worker);
  const connection: MessageConnection = createMessageConnection(reader, writer);

  const diagnosticsHandlers = new Set<(params: PublishDiagnosticsParams) => void>();
  connection.onNotification(
    "textDocument/publishDiagnostics",
    (params: PublishDiagnosticsParams) => {
      for (const handler of diagnosticsHandlers) handler(params);
    },
  );

  connection.listen();

  let initialized = false;

  async function init(): Promise<void> {
    if (initialized) return;
    const result = (await connection.sendRequest("initialize", {
      processId: null,
      rootUri: null,
      capabilities: {},
    })) as { capabilities: ServerCapabilities };
    connection.sendNotification("initialized", {});
    initialized = true;
    void result;
  }

  return {
    init,
    didOpen(uri, languageId, text) {
      connection.sendNotification("textDocument/didOpen", {
        textDocument: { uri, languageId, version: 1, text },
      });
    },
    didChange(uri, version, text) {
      connection.sendNotification("textDocument/didChange", {
        textDocument: { uri, version },
        contentChanges: [{ text }],
      });
    },
    didClose(uri) {
      connection.sendNotification("textDocument/didClose", {
        textDocument: { uri },
      });
    },
    async hover(uri, line, character) {
      const result = (await connection.sendRequest("textDocument/hover", {
        textDocument: { uri },
        position: { line, character },
      })) as Hover | null;
      return result;
    },
    onDiagnostics(handler) {
      diagnosticsHandlers.add(handler);
      return () => diagnosticsHandlers.delete(handler);
    },
    dispose() {
      connection.dispose();
      worker.terminate();
    },
  };
}

// ───── Conversion helpers ──────────────────────────────────────────

function lspSeverityToMonaco(severity: number | undefined): monaco.MarkerSeverity {
  switch (severity) {
    case 1:
      return monaco.MarkerSeverity.Error;
    case 2:
      return monaco.MarkerSeverity.Warning;
    case 3:
      return monaco.MarkerSeverity.Info;
    case 4:
      return monaco.MarkerSeverity.Hint;
    default:
      return monaco.MarkerSeverity.Error;
  }
}

function toMarker(d: Diagnostic): monaco.editor.IMarkerData {
  return {
    severity: lspSeverityToMonaco(d.severity),
    message: d.message,
    startLineNumber: d.range.start.line + 1,
    startColumn: d.range.start.character + 1,
    endLineNumber: d.range.end.line + 1,
    endColumn: d.range.end.character + 1,
    source: d.source,
    code: typeof d.code === "string" ? d.code : undefined,
  };
}

function toMonacoRange(range: LspRange): monaco.IRange {
  return {
    startLineNumber: range.start.line + 1,
    startColumn: range.start.character + 1,
    endLineNumber: range.end.line + 1,
    endColumn: range.end.character + 1,
  };
}

// ───── Monaco bridge ───────────────────────────────────────────────

const MARKER_OWNER = "dtcg-tokens-lsp";

// Wires the LSP client to a Monaco editor + model. Returns a dispose
// function that removes the bridge (markers, hover provider, listeners)
// without tearing down the LSP client itself.
export function installMonacoBridge(
  lsp: LspClient,
  model: monaco.editor.ITextModel,
): () => void {
  const uri = model.uri.toString();
  let version = 1;

  lsp.didOpen(uri, "json", model.getValue());

  const modelSub = model.onDidChangeContent(() => {
    version += 1;
    lsp.didChange(uri, version, model.getValue());
  });

  const unsubscribeDiagnostics = lsp.onDiagnostics((params) => {
    if (params.uri !== uri) return;
    const markers = params.diagnostics.map(toMarker);
    monaco.editor.setModelMarkers(model, MARKER_OWNER, markers);
  });

  // Register a hover provider scoped to JSON; the LSP itself only
  // produces hover for URIs matching .tokens / .tokens.json, so
  // attaching to JSON broadly is safe.
  const hoverProvider = monaco.languages.registerHoverProvider("json", {
    provideHover: async (hoverModel, position) => {
      if (hoverModel.uri.toString() !== uri) return null;
      const hover = await lsp.hover(
        uri,
        position.lineNumber - 1,
        position.column - 1,
      );
      if (!hover) return null;
      const contents = Array.isArray(hover.contents)
        ? hover.contents.map((c) => ({
            value: typeof c === "string" ? c : c.value,
          }))
        : typeof hover.contents === "string"
          ? [{ value: hover.contents }]
          : [{ value: hover.contents.value }];
      return {
        contents,
        range: hover.range ? toMonacoRange(hover.range) : undefined,
      };
    },
  });

  return () => {
    modelSub.dispose();
    unsubscribeDiagnostics();
    hoverProvider.dispose();
    monaco.editor.setModelMarkers(model, MARKER_OWNER, []);
    lsp.didClose(uri);
  };
}
