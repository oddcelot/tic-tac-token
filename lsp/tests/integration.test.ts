import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
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

  it("advertises color and semantic-token providers with a legend", async () => {
    const response = (await client.send("initialize", {
      processId: process.pid,
      rootUri: null,
      capabilities: {},
    })) as {
      result: {
        capabilities: {
          colorProvider: unknown;
          semanticTokensProvider: {
            legend: { tokenTypes: string[]; tokenModifiers: string[] };
            full: unknown;
          };
        };
      };
    };
    const caps = response.result.capabilities;
    expect(caps.colorProvider).toBe(true);
    expect(caps.semanticTokensProvider.full).toBe(true);
    expect(caps.semanticTokensProvider.legend.tokenTypes).toContain("property");
    expect(caps.semanticTokensProvider.legend.tokenModifiers).toContain("reference");
    client.notify("initialized", {});
  });

  it("advertises definition and references providers", async () => {
    const response = (await client.send("initialize", {
      processId: process.pid,
      rootUri: null,
      capabilities: {},
    })) as { result: { capabilities: { definitionProvider: unknown; referencesProvider: unknown } } };
    expect(response.result.capabilities.definitionProvider).toBe(true);
    expect(response.result.capabilities.referencesProvider).toBe(true);
    client.notify("initialized", {});
  });

  it("serves go-to-definition and find-references over stdio", async () => {
    await client.send("initialize", { processId: process.pid, rootUri: null, capabilities: {} });
    client.notify("initialized", {});
    const uri = "file:///def.tokens.json";
    const text = JSON.stringify(
      {
        color: {
          $type: "color",
          primary: { $value: { colorSpace: "srgb", components: [1, 0, 0], hex: "#ff0000" } },
          accent: { $value: "{color.primary}" },
        },
      },
      null,
      2,
    );
    client.notify("textDocument/didOpen", {
      textDocument: { uri, languageId: "json", version: 1, text },
    });
    await client.waitForNotification("textDocument/publishDiagnostics");

    const lineCharOf = (needle: string) => {
      const idx = text.indexOf(needle);
      const before = text.slice(0, idx);
      return {
        line: (before.match(/\n/g) ?? []).length,
        character: idx - (before.lastIndexOf("\n") + 1),
      };
    };

    // Go-to-definition from the alias jumps to the `"primary"` key.
    const aliasPos = lineCharOf('"{color.primary}"');
    const def = (await client.send("textDocument/definition", {
      textDocument: { uri },
      position: aliasPos,
    })) as { result: null | { uri: string; range: { start: { line: number } } } };
    expect(def.result).not.toBeNull();
    expect(def.result!.uri).toBe(uri);
    expect(def.result!.range.start.line).toBe(lineCharOf('"primary"').line);

    // Find-references from the definition returns the alias usage.
    const refs = (await client.send("textDocument/references", {
      textDocument: { uri },
      position: lineCharOf('"primary"'),
      context: { includeDeclaration: true },
    })) as { result: Array<{ range: { start: { line: number } } }> };
    const aliasLine = lineCharOf('"{color.primary}"').line;
    expect(refs.result.some((l) => l.range.start.line === aliasLine)).toBe(true);
  }, 15000);

  it("responds to semanticTokens/full and documentColor", async () => {
    await client.send("initialize", { processId: process.pid, rootUri: null, capabilities: {} });
    client.notify("initialized", {});
    const uri = "file:///st.tokens.json";
    const text = JSON.stringify(
      {
        color: {
          $type: "color",
          primary: { $value: { colorSpace: "srgb", components: [1, 0, 0], hex: "#ff0000" } },
          accent: { $value: "{color.primary}" },
        },
      },
      null,
      2,
    );
    client.notify("textDocument/didOpen", {
      textDocument: { uri, languageId: "json", version: 1, text },
    });
    await client.waitForNotification("textDocument/publishDiagnostics");

    const st = (await client.send("textDocument/semanticTokens/full", {
      textDocument: { uri },
    })) as { result: { data: number[] } };
    expect(st.result.data.length).toBeGreaterThan(0);
    expect(st.result.data.length % 5).toBe(0);

    const colors = (await client.send("textDocument/documentColor", {
      textDocument: { uri },
    })) as { result: Array<{ color: { red: number } }> };
    expect(colors.result.length).toBeGreaterThan(0);
    expect(colors.result.some((c) => c.color.red === 1)).toBe(true);
  }, 15000);

  it("resolves css var(--…) usages against open token docs (color + hover)", async () => {
    await client.send("initialize", { processId: process.pid, rootUri: null, capabilities: {} });
    client.notify("initialized", {});
    const tokensUri = "file:///theme.tokens.json";
    const tokensText = JSON.stringify(
      { color: { $type: "color", brand: { primary: { $value: { colorSpace: "srgb", components: [1, 0, 0], hex: "#ff0000" } } } } },
      null,
      2,
    );
    client.notify("textDocument/didOpen", {
      textDocument: { uri: tokensUri, languageId: "json", version: 1, text: tokensText },
    });
    // Wait for analysis (also seeds the workspace index).
    await client.waitForNotification("textDocument/publishDiagnostics");

    const cssUri = "file:///app.css";
    const cssText = `.btn {\n  color: var(--color-brand-primary);\n}\n`;
    client.notify("textDocument/didOpen", {
      textDocument: { uri: cssUri, languageId: "css", version: 1, text: cssText },
    });

    const colors = (await client.send("textDocument/documentColor", {
      textDocument: { uri: cssUri },
    })) as { result: Array<{ color: { red: number } }> };
    expect(colors.result).toHaveLength(1);
    expect(colors.result[0]!.color.red).toBe(1);

    const varIdx = cssText.indexOf("--color-brand-primary");
    const before = cssText.slice(0, varIdx);
    const line = (before.match(/\n/g) ?? []).length;
    const character = varIdx - (before.lastIndexOf("\n") + 1);
    const hover = (await client.send("textDocument/hover", {
      textDocument: { uri: cssUri },
      position: { line, character },
    })) as { result: null | { contents: { value: string } } };
    expect(hover.result).not.toBeNull();
    expect(hover.result!.contents.value).toContain("color.brand.primary");
    expect(hover.result!.contents.value).toContain("#ff0000");
  }, 15000);

  it("resolves an alias across workspace files via hover", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ttt-ws-"));
    try {
      const baseText = JSON.stringify(
        { color: { $type: "color", primary: { $value: { colorSpace: "srgb", components: [1, 0, 0], hex: "#ff0000" } } } },
        null,
        2,
      );
      const usageText = JSON.stringify(
        { color: { $type: "color", accent: { $value: "{color.primary}" } } },
        null,
        2,
      );
      writeFileSync(join(dir, "base.tokens.json"), baseText);
      const usagePath = join(dir, "usage.tokens.json");
      writeFileSync(usagePath, usageText);

      await client.send("initialize", {
        processId: process.pid,
        rootUri: pathToFileURL(dir).href,
        capabilities: {},
      });
      client.notify("initialized", {});
      // Give the workspace scan a moment to index base.tokens.json.
      await new Promise((r) => setTimeout(r, 300));

      const uri = pathToFileURL(usagePath).href;
      client.notify("textDocument/didOpen", {
        textDocument: { uri, languageId: "json", version: 1, text: usageText },
      });
      await client.waitForNotification("textDocument/publishDiagnostics");

      const idx = usageText.indexOf("{color.primary}");
      const before = usageText.slice(0, idx);
      const line = (before.match(/\n/g) ?? []).length;
      const character = idx - (before.lastIndexOf("\n") + 1);
      const hover = (await client.send("textDocument/hover", {
        textDocument: { uri },
        position: { line, character },
      })) as { result: null | { contents: { value: string } } };
      expect(hover.result).not.toBeNull();
      const md = hover.result!.contents.value;
      expect(md).toContain("#ff0000");
      expect(md).toContain("base.tokens.json");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 15000);

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

  it("ignores non-token JSON files (no diagnostics, null hover)", async () => {
    await client.send("initialize", { processId: process.pid, rootUri: null, capabilities: {} });
    client.notify("initialized", {});
    const uri = "file:///random/package.json";
    const text = JSON.stringify({ name: "x", arbitrary: "junk" });
    client.notify("textDocument/didOpen", {
      textDocument: { uri, languageId: "json", version: 1, text },
    });
    // Race a short timer against publishDiagnostics; the server should NOT
    // publish for a non-token URI.
    const diagnostics = await Promise.race([
      client.waitForNotification("textDocument/publishDiagnostics"),
      new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 500)),
    ]);
    expect(diagnostics).toBeUndefined();
    const hover = (await client.send("textDocument/hover", {
      textDocument: { uri },
      position: { line: 0, character: 0 },
    })) as { result: unknown };
    expect(hover.result).toBeNull();
  }, 10000);

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
