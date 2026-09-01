import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { DEFAULT_SCAN_OPTIONS } from "../src/workspace/host.ts";
import { createNodeWorkspaceHost } from "../src/workspace/host-node.ts";

const FIXTURES_DIR = fileURLToPath(new URL("./fixtures/workspace", import.meta.url));
const ROOT_URI = pathToFileURL(FIXTURES_DIR).toString();

describe("createNodeWorkspaceHost", () => {
  it("scans for .tokens/.tokens.json files, skipping excluded dirs and non-token files", async () => {
    const host = createNodeWorkspaceHost();
    const files = await host.scan([ROOT_URI], DEFAULT_SCAN_OPTIONS);

    expect(files).toHaveLength(3);
    const names = files.map((f) => f.uri.split("/").pop()).sort();
    expect(names).toEqual(["base.tokens.json", "deep.tokens", "semantic.tokens.json"]);
    // node_modules is excluded even though it contains a matching file.
    expect(files.some((f) => f.uri.includes("node_modules"))).toBe(false);
  });

  it("respects maxFiles", async () => {
    const host = createNodeWorkspaceHost();
    const files = await host.scan([ROOT_URI], { ...DEFAULT_SCAN_OPTIONS, maxFiles: 1 });

    expect(files).toHaveLength(1);
  });

  it("read() returns file content for a discovered uri", async () => {
    const host = createNodeWorkspaceHost();
    const files = await host.scan([ROOT_URI], DEFAULT_SCAN_OPTIONS);
    const base = files.find((f) => f.uri.endsWith("base.tokens.json"));
    expect(base).toBeDefined();

    const text = await host.read(base!.uri);
    expect(text).toBe(base!.text);
    expect(text).toContain("primary");
  });

  it("read() returns undefined for a missing file", async () => {
    const host = createNodeWorkspaceHost();
    const missingUri = pathToFileURL(`${FIXTURES_DIR}/does-not-exist.tokens.json`).toString();

    expect(await host.read(missingUri)).toBeUndefined();
  });
});
