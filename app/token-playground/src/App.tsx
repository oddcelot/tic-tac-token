import { createSignal, onCleanup, onMount, type Component } from "solid-js";
import Resizable from "@corvu/resizable";
import * as monaco from "monaco-editor";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import JsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import demoRaw from "./demo-tokens.json?raw";
import schemaRaw from "../../../schema.json?raw";
import { parseTokens, type FlatToken } from "./tokens";
import KitchenSink from "./KitchenSink";

self.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === "json") return new JsonWorker();
    return new EditorWorker();
  },
};

// Two schemas are registered:
//
// 1. "/schema.json" — the schema emitted by `pnpm generate-schema` from our
//    own arktype Token type. Served by the vite `rootSchemaPlugin` (see
//    vite.config.ts). Used by default for every JSON file in the editor via
//    fileMatch: ["*"]. Grades documents against this repo's implementation.
//
// 2. The canonical DTCG 2025.10 format schema. Registered by URI only (no
//    inline content) so Monaco will fetch it when a document declares
//    `"$schema": "https://www.designtokens.org/schemas/2025.10/format.json"`.
//    Useful for grading a document against the upstream spec, which in a few
//    places is stricter than ours (see docs/dtcg-spec.md for diffs).
monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
  validate: true,
  allowComments: false,
  schemas: [
    {
      uri: "/schema.json",
      fileMatch: ["*"],
      schema: JSON.parse(schemaRaw),
    },
    {
      uri: "https://www.designtokens.org/schemas/2025.10/format.json",
    },
  ],
});

injectKeyframes();

const App: Component = () => {
  let editorElement!: HTMLDivElement;
  const [raw, setRaw] = createSignal(demoRaw);
  const tokens = (): FlatToken[] => parseTokens(raw());

  onMount(() => {
    const editor = monaco.editor.create(editorElement, {
      value: demoRaw,
      language: "json",
      automaticLayout: true,
      minimap: { enabled: false },
      tabSize: 2,
    });

    const sub = editor.onDidChangeModelContent(() => {
      setRaw(editor.getValue());
    });

    onCleanup(() => {
      sub.dispose();
      editor.dispose();
    });
  });

  return (
    <div class="size-full p-4">
      <Resizable class="size-full">
        <Resizable.Panel
          initialSize={0.5}
          minSize={0.2}
          class="overflow-hidden rounded-lg bg-corvu-100"
        >
          <div ref={editorElement} class="size-full" />
        </Resizable.Panel>
        <Resizable.Handle
          aria-label="Resize Handle"
          class="group basis-3 px-0.75"
        >
          <div class="size-full rounded-sm transition-colors group-data-active:bg-corvu-300 group-data-dragging:bg-corvu-100" />
        </Resizable.Handle>
        <Resizable.Panel
          initialSize={0.5}
          minSize={0.25}
          class="overflow-hidden rounded-lg bg-corvu-100"
        >
          <KitchenSink tokens={tokens()} />
        </Resizable.Panel>
      </Resizable>
    </div>
  );
};

function injectKeyframes() {
  if (typeof document === "undefined") return;
  if (document.getElementById("token-playground-keyframes")) return;
  const style = document.createElement("style");
  style.id = "token-playground-keyframes";
  style.textContent = `@keyframes slide { 0% { transform: translateX(0); } 50% { transform: translateX(calc(100% - 8px)); } 100% { transform: translateX(0); } }`;
  document.head.appendChild(style);
}

export default App;
