import { createSignal, onCleanup, onMount, type Component } from "solid-js";
import Resizable from "@corvu/resizable";
import * as monaco from "monaco-editor";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import JsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import exampleRaw from "../../../example.json?raw";
import schemaRaw from "../../../schema.json?raw";

self.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === "json") return new JsonWorker();
    return new EditorWorker();
  },
};

monaco.json.jsonDefaults.setDiagnosticsOptions({
  validate: true,
  allowComments: false,
  schemas: [
    {
      uri: "file:///schema.json",
      fileMatch: ["*"],
      schema: JSON.parse(schemaRaw),
    },
  ],
});

const App: Component = () => {
  let editorElement!: HTMLDivElement;
  const [preview, setPreview] = createSignal(formatPreview(exampleRaw));

  onMount(() => {
    const editor = monaco.editor.create(editorElement, {
      value: exampleRaw,
      language: "json",
      automaticLayout: true,
      minimap: { enabled: false },
      tabSize: 2,
    });

    const sub = editor.onDidChangeModelContent(() => {
      setPreview(formatPreview(editor.getValue()));
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
          initialSize={0.4}
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
          initialSize={0.4}
          minSize={0.2}
          class="overflow-auto rounded-lg bg-corvu-100 p-3"
        >
          <pre class="font-mono text-xs whitespace-pre-wrap">{preview()}</pre>
        </Resizable.Panel>
        <Resizable.Handle
          aria-label="Resize Handle"
          class="group basis-3 px-0.75"
        >
          <div class="size-full rounded-sm transition-colors group-data-active:bg-corvu-300 group-data-dragging:bg-corvu-100" />
        </Resizable.Handle>
        <Resizable.Panel
          initialSize={0.2}
          minSize={0.1}
          class="rounded-lg bg-corvu-100"
        />
      </Resizable>
    </div>
  );
};

function formatPreview(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch (err) {
    return `// invalid JSON\n${(err as Error).message}`;
  }
}

export default App;
