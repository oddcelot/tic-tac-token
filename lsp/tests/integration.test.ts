import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const SERVER_PATH = fileURLToPath(new URL("../dist/server.js", import.meta.url));

// Minimal LSP JSON-RPC client over stdio. Just enough to drive the
// server through initialize → didOpen → publishDiagnostics for a smoke
// check that the layers wire up.
class LspClient {
  private child!: ChildProcessWithoutNullStreams;
  private buffer = Buffer.alloc(0);
  private nextId = 1;
  private pending = new Map<number, (msg: unknown) => void>();
  private notifications: unknown[] = [];
  private notificationWaiters: Array<{ method: string; resolve: (msg: unknown) => void }> = [];

  start(): void {
    this.child = spawn(process.execPath, [SERVER_PATH, "--stdio"], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.child.stdout.on("data", (chunk: Buffer) => this.onData(chunk));
    this.child.stderr.on("data", () => {
      // Server stderr is discarded; LSP keeps logs out of band.
    });
  }

  async stop(): Promise<void> {
    this.child.kill();
    await new Promise<void>((resolve) => this.child.once("close", () => resolve()));
  }

  send(method: string, params: unknown): Promise<unknown> {
    const id = this.nextId++;
    const promise = new Promise<unknown>((resolve) => this.pending.set(id, resolve));
    this.writeMessage({ jsonrpc: "2.0", id, method, params });
    return promise;
  }

  notify(method: string, params: unknown): void {
    this.writeMessage({ jsonrpc: "2.0", method, params });
  }

  waitForNotification(method: string): Promise<unknown> {
    const existing = this.notifications.find(
      (n) => typeof n === "object" && n && (n as { method?: string }).method === method,
    );
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve) => {
      this.notificationWaiters.push({ method, resolve });
    });
  }

  private writeMessage(message: unknown): void {
    const body = JSON.stringify(message);
    const header = `Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n`;
    this.child.stdin.write(header + body);
  }

  private onData(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (true) {
      const sep = "\r\n\r\n";
      const headerEnd = this.buffer.indexOf(sep);
      if (headerEnd === -1) return;
      const header = this.buffer.subarray(0, headerEnd).toString("utf8");
      const lenMatch = header.match(/Content-Length:\s*(\d+)/i);
      if (!lenMatch) {
        this.buffer = this.buffer.subarray(headerEnd + sep.length);
        continue;
      }
      const length = Number(lenMatch[1]);
      const bodyStart = headerEnd + sep.length;
      if (this.buffer.length < bodyStart + length) return;
      const body = this.buffer.subarray(bodyStart, bodyStart + length).toString("utf8");
      this.buffer = this.buffer.subarray(bodyStart + length);
      try {
        const parsed = JSON.parse(body) as { id?: number; method?: string };
        if (typeof parsed.id === "number" && this.pending.has(parsed.id)) {
          const resolver = this.pending.get(parsed.id)!;
          this.pending.delete(parsed.id);
          resolver(parsed);
        } else if (typeof parsed.method === "string") {
          this.notifications.push(parsed);
          const waiterIdx = this.notificationWaiters.findIndex((w) => w.method === parsed.method);
          if (waiterIdx >= 0) {
            const waiter = this.notificationWaiters.splice(waiterIdx, 1)[0]!;
            waiter.resolve(parsed);
          }
        }
      } catch {
        // ignore
      }
    }
  }
}

describe("LSP server (integration)", () => {
  let client: LspClient;

  beforeEach(() => {
    client = new LspClient();
    client.start();
  });

  afterEach(async () => {
    await client.stop();
  });

  it("initializes and reports hover capability", async () => {
    const response = (await client.send("initialize", {
      processId: process.pid,
      rootUri: null,
      capabilities: {},
    })) as { result: { capabilities: { hoverProvider: boolean } } };
    expect(response.result.capabilities.hoverProvider).toBe(true);
    client.notify("initialized", {});
  });

  it("publishes diagnostics for an invalid color", async () => {
    await client.send("initialize", { processId: process.pid, rootUri: null, capabilities: {} });
    client.notify("initialized", {});
    client.notify("textDocument/didOpen", {
      textDocument: {
        uri: "file:///bad.tokens.json",
        languageId: "json",
        version: 1,
        text: JSON.stringify({
          color: { primary: { $type: "color", $value: "not-an-object" } },
        }),
      },
    });
    const notification = (await client.waitForNotification(
      "textDocument/publishDiagnostics",
    )) as { params: { diagnostics: unknown[] } };
    expect(notification.params.diagnostics.length).toBeGreaterThan(0);
  }, 15000);

  it("responds to hover with markdown for a token", async () => {
    await client.send("initialize", { processId: process.pid, rootUri: null, capabilities: {} });
    client.notify("initialized", {});
    const uri = "file:///good.tokens.json";
    const text = JSON.stringify(
      {
        color: {
          $type: "color",
          primary: {
            $value: {
              colorSpace: "srgb",
              components: [1, 0, 0],
              alpha: 1,
              hex: "#ff0000",
            },
          },
        },
      },
      null,
      2,
    );
    client.notify("textDocument/didOpen", {
      textDocument: { uri, languageId: "json", version: 1, text },
    });
    // Wait for diagnostics so the analyzer has run.
    await client.waitForNotification("textDocument/publishDiagnostics");
    // Position the cursor on the "hex" property of the inner $value
    const idx = text.indexOf('"hex"');
    const before = text.slice(0, idx);
    const line = (before.match(/\n/g) ?? []).length;
    const lastNewline = before.lastIndexOf("\n");
    const character = idx - (lastNewline + 1);
    const response = (await client.send("textDocument/hover", {
      textDocument: { uri },
      position: { line, character },
    })) as { result: null | { contents: { value: string } } };
    expect(response.result).not.toBeNull();
    expect(response.result?.contents.value).toContain("color.primary");
    expect(response.result?.contents.value).toContain("#ff0000");
  }, 15000);
});
