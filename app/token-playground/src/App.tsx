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

// The editor's model gets a stable `file:///` URI (see the createModel call
// in onMount below) so that `$schema: "/schema.json"` in a document resolves
// to the absolute URI `file:///schema.json`. We register the repo-emitted
// schema under that exact URI and inline its content, so Monaco finds it
// without needing a schema-request service (the browser has no way to
// resolve `file://` URLs at runtime anyway).
//
// Two schemas are registered:
//
// 1. "file:///schema.json" — our repo-emitted schema. Default for every
//    JSON file in the editor via fileMatch: ["*"]. Grades documents
//    against this repo's implementation.
//
// 2. The canonical DTCG 2025.10 format schema. Registered by URI only (no
//    inline content) so Monaco fetches it when a document declares
//    `"$schema": "https://www.designtokens.org/schemas/2025.10/format.json"`.
//    Useful for grading a document against the upstream spec, which in a
//    few places is stricter than ours (see docs/dtcg-spec.md for diffs).
//    Requires network access + permissive CORS on designtokens.org.
monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
  validate: true,
  allowComments: false,
  schemas: [
    {
      uri: "file:///schema.json",
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
    // Give the model a file:/// URI so relative $schema references in the
    // document resolve against a predictable absolute URI and match the
    // schema registrations in monaco.languages.json.jsonDefaults above.
    const modelUri = monaco.Uri.parse("file:///demo-tokens.json");
    const model =
      monaco.editor.getModel(modelUri) ??
      monaco.editor.createModel(demoRaw, "json", modelUri);
    const editor = monaco.editor.create(editorElement, {
      model,
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
      model.dispose();
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
