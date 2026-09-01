import * as monaco from "monaco-editor";
import {
  BrowserMessageReader,
  BrowserMessageWriter,
  createMessageConnection,
  type MessageConnection,
} from "vscode-jsonrpc/browser";
import type {
  Color,
  ColorInformation,
  ColorPresentation,
  CompletionItem,
  CompletionList,
  Diagnostic,
  Hover,
  PublishDiagnosticsParams,
  Range as LspRange,
  ServerCapabilities,
  TextEdit,
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
  completion(
    uri: string,
    line: number,
    character: number,
  ): Promise<CompletionList | CompletionItem[] | null>;
  documentColor(uri: string): Promise<ColorInformation[]>;
  colorPresentation(
    uri: string,
    color: Color,
    range: LspRange,
  ): Promise<ColorPresentation[]>;
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
    async completion(uri, line, character) {
      const result = (await connection.sendRequest("textDocument/completion", {
        textDocument: { uri },
        position: { line, character },
      })) as CompletionList | CompletionItem[] | null;
      return result;
    },
    async documentColor(uri) {
      const result = (await connection.sendRequest("textDocument/documentColor", {
        textDocument: { uri },
      })) as ColorInformation[] | null;
      return result ?? [];
    },
    async colorPresentation(uri, color, range) {
      const result = (await connection.sendRequest("textDocument/colorPresentation", {
        textDocument: { uri },
        color,
        range,
      })) as ColorPresentation[] | null;
      return result ?? [];
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

function toLspRange(range: monaco.IRange): LspRange {
  return {
    start: { line: range.startLineNumber - 1, character: range.startColumn - 1 },
    end: { line: range.endLineNumber - 1, character: range.endColumn - 1 },
  };
}

// LSP's `Color` and Monaco's `IColor` are structurally identical (red/green/
// blue/alpha as 0..1 floats) — no numeric conversion needed, just a type
// rename at the boundary.
function toMonacoColor(color: Color): monaco.languages.IColor {
  return {
    red: color.red,
    green: color.green,
    blue: color.blue,
    alpha: color.alpha,
  };
}

// LSP CompletionItemKind values are 1..25 (variable = 6); Monaco's
// own enum uses different numbers. Map the few we currently emit.
function lspCompletionKindToMonaco(
  kind: number | undefined,
): monaco.languages.CompletionItemKind {
  switch (kind) {
    case 6: // Variable
      return monaco.languages.CompletionItemKind.Variable;
    case 14: // Keyword
      return monaco.languages.CompletionItemKind.Keyword;
    case 12: // Value
      return monaco.languages.CompletionItemKind.Value;
    case 21: // Constant
      return monaco.languages.CompletionItemKind.Constant;
    default:
      return monaco.languages.CompletionItemKind.Variable;
  }
}

function isTextEdit(
  edit: TextEdit | { range: LspRange; newText: string } | undefined,
): edit is { range: LspRange; newText: string } {
  return !!edit && typeof edit === "object" && "range" in edit && "newText" in edit;
}

function toMonacoCompletion(
  item: CompletionItem,
  fallbackRange: monaco.IRange,
): monaco.languages.CompletionItem {
  const edit = isTextEdit(item.textEdit) ? item.textEdit : undefined;
  const insertText = edit?.newText ?? item.insertText ?? item.label;
  const range = edit ? toMonacoRange(edit.range) : fallbackRange;
  const docs = item.documentation;
  return {
    label: item.label,
    kind: lspCompletionKindToMonaco(item.kind),
    detail: item.detail,
    documentation:
      typeof docs === "string"
        ? docs
        : docs && "value" in docs
          ? { value: docs.value }
          : undefined,
    insertText: typeof insertText === "string" ? insertText : item.label,
    range,
    filterText: item.filterText,
    sortText: item.sortText,
  };
}

// ───── Monaco bridge ───────────────────────────────────────────────

const MARKER_OWNER = "dtcg-tokens-lsp";

// Wires the LSP client to a Monaco editor + model. Returns a dispose
// function that removes the bridge (markers, hover/color providers,
// listeners) without tearing down the LSP client itself.
//
// `languageId` selects both the Monaco language the providers attach to
// and the `languageId` reported in `textDocument/didOpen`. Alias
// completion is JSON-only (the LSP only emits it inside a curly-brace
// alias context in token documents); hover and document-color are wired
// for both "json" and "css" so `var(--token-name)` in stylesheets also
// resolves.
export function installMonacoBridge(
  lsp: LspClient,
  model: monaco.editor.ITextModel,
  languageId: "json" | "css" = "json",
): () => void {
  const uri = model.uri.toString();
  let version = 1;

  lsp.didOpen(uri, languageId, model.getValue());

  const modelSub = model.onDidChangeContent(() => {
    version += 1;
    lsp.didChange(uri, version, model.getValue());
  });

  const unsubscribeDiagnostics = lsp.onDiagnostics((params) => {
    if (params.uri !== uri) return;
    const markers = params.diagnostics.map(toMarker);
    monaco.editor.setModelMarkers(model, MARKER_OWNER, markers);
  });

  // Hover provider, URI-guarded to this model. Registered separately per
  // language (json vs css) since each call to installMonacoBridge owns a
  // single model.
  const hoverProvider = monaco.languages.registerHoverProvider(languageId, {
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

  // Document-color provider, URI-guarded to this model. Powers inline
  // swatches for `var(--token-name)` (css) and raw color values (json).
  const colorProvider = monaco.languages.registerColorProvider(languageId, {
    provideDocumentColors: async (colorModel) => {
      if (colorModel.uri.toString() !== uri) return [];
      const colors = await lsp.documentColor(uri);
      return colors.map((c) => ({
        color: toMonacoColor(c.color),
        range: toMonacoRange(c.range),
      }));
    },
    provideColorPresentations: async (colorModel, colorInfo) => {
      if (colorModel.uri.toString() !== uri) return [];
      const presentations = await lsp.colorPresentation(
        uri,
        {
          red: colorInfo.color.red,
          green: colorInfo.color.green,
          blue: colorInfo.color.blue,
          alpha: colorInfo.color.alpha,
        },
        toLspRange(colorInfo.range),
      );
      return presentations.map((p) => ({ label: p.label }));
    },
  });

  // Alias completion. JSON-only — see doc comment above.
  const completionProvider =
    languageId === "json"
      ? monaco.languages.registerCompletionItemProvider("json", {
          triggerCharacters: ["{", "."],
          provideCompletionItems: async (completionModel, position) => {
            if (completionModel.uri.toString() !== uri) {
              return { suggestions: [] };
            }
            const result = await lsp.completion(
              uri,
              position.lineNumber - 1,
              position.column - 1,
            );
            if (!result) return { suggestions: [] };
            const items = Array.isArray(result) ? result : result.items;
            // Default range used when an item omits its own textEdit: just
            // the cursor position, no replacement (insert at cursor).
            const fallbackRange: monaco.IRange = {
              startLineNumber: position.lineNumber,
              startColumn: position.column,
              endLineNumber: position.lineNumber,
              endColumn: position.column,
            };
            return {
              suggestions: items.map((item) =>
                toMonacoCompletion(item, fallbackRange),
              ),
            };
          },
        })
      : undefined;

  return () => {
    modelSub.dispose();
    unsubscribeDiagnostics();
    hoverProvider.dispose();
    colorProvider.dispose();
    completionProvider?.dispose();
    monaco.editor.setModelMarkers(model, MARKER_OWNER, []);
    lsp.didClose(uri);
  };
}
