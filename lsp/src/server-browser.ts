import {
  BrowserMessageReader,
  BrowserMessageWriter,
  createConnection,
} from "vscode-languageserver/browser";
import { registerServer } from "./bootstrap.ts";

// Browser Worker entry. The Worker's global `self` doubles as both the
// inbound message source and the outbound postMessage target — typed
// as `DedicatedWorkerGlobalScope` in DOM lib, but we don't pull DOM
// types into the LSP package. Bridge via `globalThis` and cast to
// `never` to satisfy MessageReader/Writer signatures without dragging
// in lib.dom.
const workerScope = globalThis as never;
const reader = new BrowserMessageReader(workerScope);
const writer = new BrowserMessageWriter(workerScope);
const connection = createConnection(reader, writer);
registerServer(connection);
connection.listen();
