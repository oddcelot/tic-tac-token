import {
  createEffect,
  createSignal,
  For,
  Show,
  type Component,
  type JSX,
} from "solid-js";
import * as monaco from "monaco-editor";

// What we render per outline row. `kind` distinguishes groups (expandable,
// contain children) from tokens (leaf nodes — we stop descending into their
// $value / $type / $description so the tree doesn't explode).
type OutlineNode = {
  name: string;
  kind: "group" | "token" | "meta";
  tokenType?: string;
  range: monaco.IRange;
  children: OutlineNode[];
};

const RESERVED_KEYS = new Set([
  "$schema",
  "$type",
  "$value",
  "$ref",
  "$description",
  "$extensions",
  "$extends",
  "$deprecated",
  "$root",
]);

async function fetchSymbols(
  modelUri: monaco.Uri,
): Promise<monaco.languages.DocumentSymbol[]> {
  const factory = await monaco.languages.json.getWorker();
  const worker = await factory(modelUri);
  // The returned symbols are vscode-json-languageservice shapes; their
  // `range` already matches monaco.IRange structurally.
  return ((await worker.findDocumentSymbols(
    modelUri.toString(),
  )) as unknown as monaco.languages.DocumentSymbol[]) ?? [];
}

// Turn a raw DocumentSymbol tree into our render-ready outline. Token leaves
// are recognised by having children that include both `$type` and `$value`
// (or a `$ref`), mirroring the DTCG spec's token-vs-group rule.
function toOutline(
  symbols: monaco.languages.DocumentSymbol[],
): OutlineNode[] {
  const out: OutlineNode[] = [];
  for (const sym of symbols) {
    // Flatten through the synthetic root object JSON produces (its name is
    // typically empty or the literal "object"), otherwise we'd add an extra
    // layer above the user's tokens.
    if (
      sym.kind === monaco.languages.SymbolKind.Object &&
      (!sym.name || sym.name === "object") &&
      sym.children?.length
    ) {
      out.push(...toOutline(sym.children));
      continue;
    }

    const rawChildren = sym.children ?? [];
    const childNames = new Set(rawChildren.map((c) => c.name));
    const hasValue = childNames.has("$value") || childNames.has("$ref");
    const hasType = childNames.has("$type");
    const typeChild = rawChildren.find((c) => c.name === "$type");
    const tokenType = typeChild?.detail || typeChild?.name;

    if (RESERVED_KEYS.has(sym.name)) {
      // Render reserved $-keys (especially on the root group) but don't
      // descend further — their contents are rarely interesting in an
      // outline.
      out.push({
        name: sym.name,
        kind: "meta",
        range: sym.range,
        children: [],
      });
      continue;
    }

    if (hasValue || hasType) {
      out.push({
        name: sym.name,
        kind: "token",
        tokenType: typeChild?.detail,
        range: sym.range,
        children: [],
      });
      continue;
    }

    // Otherwise it's a group: recurse into children, filtering out reserved
    // keys we already handled as meta so we don't double-render.
    out.push({
      name: sym.name,
      kind: "group",
      range: sym.range,
      children: toOutline(rawChildren),
    });
  }
  return out;
}

export const Outline: Component<{
  raw: string;
  editor: () => monaco.editor.IStandaloneCodeEditor | null;
  modelUri: monaco.Uri;
}> = (props) => {
  const [nodes, setNodes] = createSignal<OutlineNode[]>([]);

  createEffect(() => {
    // Re-fetch whenever the document text changes. The model is already
    // up to date by the time this runs (onDidChangeModelContent fires
    // after the edit is applied).
    void props.raw;
    fetchSymbols(props.modelUri)
      .then((syms) => setNodes(toOutline(syms)))
      .catch(() => setNodes([]));
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

  return (
    <div class="flex size-full flex-col overflow-hidden">
      <div class="border-b border-gray-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:text-gray-400">
        Outline
      </div>
      <div class="flex-1 overflow-auto py-2 font-mono text-xs">
        <Show
          when={nodes().length > 0}
          fallback={
            <div class="px-3 py-2 text-gray-500 dark:text-gray-400">
              (empty)
            </div>
          }
        >
          <For each={nodes()}>
            {(node) => <OutlineRow node={node} depth={0} onSelect={reveal} />}
          </For>
        </Show>
      </div>
    </div>
  );
};

const OutlineRow: Component<{
  node: OutlineNode;
  depth: number;
  onSelect: (range: monaco.IRange) => void;
}> = (props) => {
  const [open, setOpen] = createSignal(props.depth < 2);
  const hasChildren = () => props.node.children.length > 0;
  const indent = () => `${props.depth * 0.75 + 0.5}rem`;

  const iconColor = () => {
    switch (props.node.kind) {
      case "token":
        return "text-indigo-500 dark:text-indigo-400";
      case "meta":
        return "text-amber-600 dark:text-amber-400";
      default:
        return "text-gray-400 dark:text-gray-500";
    }
  };

  const onClick: JSX.EventHandler<HTMLButtonElement, MouseEvent> = (e) => {
    if (hasChildren() && !e.altKey) setOpen((v) => !v);
    props.onSelect(props.node.range);
  };

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        class="flex w-full items-center gap-1 px-2 py-0.5 text-left text-gray-800 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
        style={{ "padding-left": indent() }}
      >
        <span class="w-3 text-xs text-gray-400 dark:text-gray-500">
          {hasChildren() ? (open() ? "▾" : "▸") : ""}
        </span>
        <span class={iconColor()}>●</span>
        <span class="truncate">{props.node.name}</span>
        <Show when={props.node.kind === "token" && props.node.tokenType}>
          <span class="ml-auto pl-2 text-gray-400 dark:text-gray-500">
            {props.node.tokenType}
          </span>
        </Show>
      </button>
      <Show when={hasChildren() && open()}>
        <For each={props.node.children}>
          {(child) => (
            <OutlineRow
              node={child}
              depth={props.depth + 1}
              onSelect={props.onSelect}
            />
          )}
        </For>
      </Show>
    </>
  );
};

export default Outline;
