import "@vscode/codicons/dist/codicon.css";
import {
  createEffect,
  createSignal,
  For,
  onCleanup,
  Show,
  type Accessor,
  type Component,
  type JSX,
} from "solid-js";
import * as monaco from "monaco-editor";

// The outline mirrors Monaco's DocumentSymbol tree 1:1 — same depth, same
// names, same ranges. We do no filtering or reshaping; this is the closest
// thing to VS Code's native Outline view we can build on top of the
// monaco-editor standalone package.

type Symbol = monaco.languages.DocumentSymbol;

async function fetchSymbols(modelUri: monaco.Uri): Promise<Symbol[]> {
  const factory = await monaco.languages.json.getWorker();
  const worker = await factory(modelUri);
  return (
    ((await worker.findDocumentSymbols(
      modelUri.toString(),
    )) as unknown as Symbol[]) ?? []
  );
}

// VS Code's symbolIcons.css relies on `codicon-symbol-<kind>` class names.
// Map Monaco's SymbolKind enum to the matching codicon.
const iconClassForKind = (kind: monaco.languages.SymbolKind): string => {
  const SK = monaco.languages.SymbolKind;
  switch (kind) {
    case SK.File:
      return "codicon-symbol-file";
    case SK.Module:
      return "codicon-symbol-module";
    case SK.Namespace:
      return "codicon-symbol-namespace";
    case SK.Package:
      return "codicon-symbol-package";
    case SK.Class:
      return "codicon-symbol-class";
    case SK.Method:
      return "codicon-symbol-method";
    case SK.Property:
      return "codicon-symbol-property";
    case SK.Field:
      return "codicon-symbol-field";
    case SK.Constructor:
      return "codicon-symbol-constructor";
    case SK.Enum:
      return "codicon-symbol-enum";
    case SK.Interface:
      return "codicon-symbol-interface";
    case SK.Function:
      return "codicon-symbol-function";
    case SK.Variable:
      return "codicon-symbol-variable";
    case SK.Constant:
      return "codicon-symbol-constant";
    case SK.String:
      return "codicon-symbol-string";
    case SK.Number:
      return "codicon-symbol-number";
    case SK.Boolean:
      return "codicon-symbol-boolean";
    case SK.Array:
      return "codicon-symbol-array";
    case SK.Object:
      return "codicon-symbol-object";
    case SK.Key:
      return "codicon-symbol-key";
    case SK.Null:
      return "codicon-symbol-null";
    case SK.EnumMember:
      return "codicon-symbol-enum-member";
    case SK.Struct:
      return "codicon-symbol-struct";
    case SK.Event:
      return "codicon-symbol-event";
    case SK.Operator:
      return "codicon-symbol-operator";
    case SK.TypeParameter:
      return "codicon-symbol-type-parameter";
    default:
      return "codicon-symbol-property";
  }
};

// Does this position sit inside this symbol's range?
const containsPosition = (
  range: monaco.IRange,
  pos: monaco.IPosition,
): boolean => {
  if (pos.lineNumber < range.startLineNumber) return false;
  if (pos.lineNumber > range.endLineNumber) return false;
  if (
    pos.lineNumber === range.startLineNumber &&
    pos.column < range.startColumn
  )
    return false;
  if (pos.lineNumber === range.endLineNumber && pos.column > range.endColumn)
    return false;
  return true;
};

// Return the array of indices describing the deepest symbol chain
// containing the cursor position, or [] if none.
const findCursorPath = (
  symbols: Symbol[],
  pos: monaco.IPosition,
): number[] => {
  for (let i = 0; i < symbols.length; i++) {
    const s = symbols[i];
    if (!containsPosition(s.range, pos)) continue;
    const child = s.children?.length
      ? findCursorPath(s.children, pos)
      : [];
    return [i, ...child];
  }
  return [];
};

export const Outline: Component<{
  raw: string;
  editor: Accessor<monaco.editor.IStandaloneCodeEditor | null>;
  modelUri: monaco.Uri;
}> = (props) => {
  const [nodes, setNodes] = createSignal<Symbol[]>([]);
  const [cursorPath, setCursorPath] = createSignal<number[]>([]);
  // Expansion state keyed by "/"-joined index path; the empty string is the
  // root. Any path in the set is expanded. We seed it so the first two
  // levels are open by default, mirroring how VS Code's outline opens.
  const [expanded, setExpanded] = createSignal<Set<string>>(new Set(["", "0"]));

  // Re-fetch whenever the document text changes.
  createEffect(() => {
    void props.raw;
    fetchSymbols(props.modelUri)
      .then((syms) => setNodes(syms))
      .catch(() => setNodes([]));
  });

  // Track cursor position to highlight the containing symbol.
  createEffect(() => {
    const editor = props.editor();
    if (!editor) return;
    const update = () => {
      const pos = editor.getPosition();
      if (!pos) return;
      setCursorPath(findCursorPath(nodes(), pos));
    };
    update();
    const sub = editor.onDidChangeCursorPosition(update);
    onCleanup(() => sub.dispose());
  });

  // Auto-expand ancestors of the cursor's symbol so the selection is
  // actually visible.
  createEffect(() => {
    const path = cursorPath();
    if (!path.length) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      for (let i = 0; i < path.length; i++) {
        next.add(path.slice(0, i).join("/"));
      }
      return next;
    });
  });

  const reveal = (range: monaco.IRange) => {
    const editor = props.editor();
    if (!editor) return;
    const position = {
      lineNumber: range.startLineNumber,
      column: range.startColumn,
    };
    editor.setPosition(position);
    editor.revealPositionInCenter(position, monaco.editor.ScrollType.Smooth);
    editor.focus();
  };

  const openQuickOutline = () => {
    const editor = props.editor();
    if (!editor) return;
    editor.focus();
    editor.getAction("editor.action.quickOutline")?.run();
  };

  const togglePath = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const isOnCursorPath = (path: number[]) => {
    const cp = cursorPath();
    if (cp.length < path.length) return false;
    for (let i = 0; i < path.length; i++) if (cp[i] !== path[i]) return false;
    return true;
  };

  return (
    <div class="flex size-full flex-col overflow-hidden">
      <div class="flex items-center justify-between border-b border-gray-200 px-3 py-2 dark:border-gray-700">
        <span class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Outline
        </span>
        <button
          type="button"
          onClick={openQuickOutline}
          title="Go to Symbol (⇧⌘O)"
          aria-label="Go to Symbol"
          class="inline-flex h-6 w-6 items-center justify-center rounded text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
        >
          <span class="codicon codicon-search" aria-hidden="true" />
        </button>
      </div>
      <div class="flex-1 overflow-auto py-1 text-xs">
        <Show
          when={nodes().length > 0}
          fallback={
            <div class="px-3 py-2 text-gray-500 dark:text-gray-400">
              (no symbols)
            </div>
          }
        >
          <For each={nodes()}>
            {(sym, i) => (
              <OutlineRow
                symbol={sym}
                path={[i()]}
                depth={0}
                expanded={expanded}
                togglePath={togglePath}
                onSelect={reveal}
                isOnCursorPath={isOnCursorPath}
                cursorPath={cursorPath}
              />
            )}
          </For>
        </Show>
      </div>
    </div>
  );
};

const OutlineRow: Component<{
  symbol: Symbol;
  path: number[];
  depth: number;
  expanded: Accessor<Set<string>>;
  togglePath: (path: string) => void;
  onSelect: (range: monaco.IRange) => void;
  isOnCursorPath: (path: number[]) => boolean;
  cursorPath: Accessor<number[]>;
}> = (props) => {
  const pathKey = () => props.path.join("/");
  const hasChildren = () => (props.symbol.children?.length ?? 0) > 0;
  const open = () => props.expanded().has(pathKey());
  const indent = () => `${props.depth * 0.75 + 0.25}rem`;

  const isExactCursor = () => {
    const cp = props.cursorPath();
    if (cp.length !== props.path.length) return false;
    for (let i = 0; i < cp.length; i++) if (cp[i] !== props.path[i]) return false;
    return true;
  };

  const onClick: JSX.EventHandler<HTMLButtonElement, MouseEvent> = (e) => {
    if (hasChildren() && !e.altKey) props.togglePath(pathKey());
    props.onSelect(props.symbol.range);
  };

  const rowClasses = () => {
    const base =
      "flex w-full items-center gap-1 px-2 py-0.5 text-left transition-colors";
    if (isExactCursor()) {
      return `${base} bg-indigo-100 text-indigo-900 dark:bg-indigo-900/40 dark:text-indigo-100`;
    }
    if (props.isOnCursorPath(props.path)) {
      return `${base} text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800`;
    }
    return `${base} text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800`;
  };

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        class={rowClasses()}
        style={{ "padding-left": indent() }}
        aria-expanded={hasChildren() ? open() : undefined}
      >
        <span class="w-3 text-[10px] leading-none text-gray-400 dark:text-gray-500">
          {hasChildren() ? (open() ? "▾" : "▸") : ""}
        </span>
        <span
          class={`codicon ${iconClassForKind(props.symbol.kind)}`}
          aria-hidden="true"
        />
        <span class="truncate font-mono">{props.symbol.name}</span>
        <Show when={props.symbol.detail}>
          <span class="ml-auto pl-2 font-mono text-gray-400 dark:text-gray-500">
            {props.symbol.detail}
          </span>
        </Show>
      </button>
      <Show when={hasChildren() && open()}>
        <For each={props.symbol.children}>
          {(child, i) => (
            <OutlineRow
              symbol={child}
              path={[...props.path, i()]}
              depth={props.depth + 1}
              expanded={props.expanded}
              togglePath={props.togglePath}
              onSelect={props.onSelect}
              isOnCursorPath={props.isOnCursorPath}
              cursorPath={props.cursorPath}
            />
          )}
        </For>
      </Show>
    </>
  );
};

export default Outline;
