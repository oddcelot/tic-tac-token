import {
  createEffect,
  createSignal,
  onCleanup,
  onMount,
  type Component,
} from "solid-js";
import Resizable from "@corvu/resizable";
import * as monaco from "monaco-editor";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import JsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import demoRaw from "./demo-tokens.json?raw";
import schemaRaw from "../../../schema.json?raw";
import { parseTokens, type FlatToken, type TokenMode } from "./tokens";
import KitchenSink from "./KitchenSink";
import { ThemeToggle, type Theme } from "./ThemeToggle";
import { Outline } from "./Outline";

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

const THEME_STORAGE_KEY = "tic-tac-token.theme";
const SCHEME_STORAGE_KEY = "tic-tac-token.scheme";

const initialTheme = (): Theme => {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

const initialScheme = (): TokenMode => {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(SCHEME_STORAGE_KEY);
  return stored === "dark" ? "dark" : "light";
};

const MODEL_URI = monaco.Uri.parse("file:///demo-tokens.json");

const App: Component = () => {
  let editorElement!: HTMLDivElement;
  const [raw, setRaw] = createSignal(demoRaw);
  const [theme, setTheme] = createSignal<Theme>(initialTheme());
  const [scheme, setScheme] = createSignal<TokenMode>(initialScheme());
  const [editorRef, setEditorRef] =
    createSignal<monaco.editor.IStandaloneCodeEditor | null>(null);
  const tokens = (): FlatToken[] => parseTokens(raw(), scheme());

  // Apply theme to <html>, Monaco, and localStorage whenever it changes.
  createEffect(() => {
    const t = theme();
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", t === "dark");
    }
    monaco.editor.setTheme(t === "dark" ? "vs-dark" : "vs");
    if (typeof window !== "undefined") {
      window.localStorage.setItem(THEME_STORAGE_KEY, t);
    }
  });

  // Persist the token scheme (mode) — its effect on the preview happens
  // via the parseTokens call in `tokens()` above.
  createEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SCHEME_STORAGE_KEY, scheme());
    }
  });

  onMount(() => {
    // Give the model a file:/// URI so relative $schema references in the
    // document resolve against a predictable absolute URI and match the
    // schema registrations in monaco.languages.json.jsonDefaults above.
    const model =
      monaco.editor.getModel(MODEL_URI) ??
      monaco.editor.createModel(demoRaw, "json", MODEL_URI);
    const editor = monaco.editor.create(editorElement, {
      model,
      automaticLayout: true,
      minimap: { enabled: false },
      tabSize: 2,
      theme: theme() === "dark" ? "vs-dark" : "vs",
    });
    setEditorRef(editor);

    const sub = editor.onDidChangeModelContent(() => {
      setRaw(editor.getValue());
    });

    onCleanup(() => {
      sub.dispose();
      editor.dispose();
      model.dispose();
      setEditorRef(null);
    });
  });

  return (
    <div class="flex size-full flex-col gap-3 bg-white p-4 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <header class="flex items-center justify-between">
        <h1 class="text-sm font-semibold tracking-wide">Token Playground</h1>
        <ThemeToggle theme={theme()} onChange={setTheme} />
      </header>
      <Resizable class="min-h-0 flex-1">
        <Resizable.Panel
          initialSize={0.4}
          minSize={0.2}
          class="overflow-hidden rounded-lg bg-corvu-100 dark:bg-gray-900"
        >
          <div ref={editorElement} class="size-full" />
        </Resizable.Panel>
        <Resizable.Handle
          aria-label="Resize Handle"
          class="group basis-3 px-0.75"
        >
          <div class="size-full rounded-sm transition-colors group-data-active:bg-corvu-300 group-data-dragging:bg-corvu-100 dark:group-data-active:bg-gray-700 dark:group-data-dragging:bg-gray-800" />
        </Resizable.Handle>
        <Resizable.Panel
          initialSize={0.2}
          minSize={0.1}
          class="overflow-hidden rounded-lg bg-corvu-100 dark:bg-gray-900"
        >
          <Outline raw={raw()} editor={editorRef} modelUri={MODEL_URI} />
        </Resizable.Panel>
        <Resizable.Handle
          aria-label="Resize Handle"
          class="group basis-3 px-0.75"
        >
          <div class="size-full rounded-sm transition-colors group-data-active:bg-corvu-300 group-data-dragging:bg-corvu-100 dark:group-data-active:bg-gray-700 dark:group-data-dragging:bg-gray-800" />
        </Resizable.Handle>
        <Resizable.Panel
          initialSize={0.4}
          minSize={0.2}
          class="overflow-hidden rounded-lg bg-corvu-100 dark:bg-gray-900"
        >
          <KitchenSink
            tokens={tokens()}
            scheme={scheme()}
            onSchemeChange={setScheme}
          />
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
