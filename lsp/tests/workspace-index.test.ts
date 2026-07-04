import { describe, expect, it } from "vitest";
import { analyze } from "../src/analyzer.ts";
import { WorkspaceIndex } from "../src/workspace/index.ts";

const RED = JSON.stringify({
  color: {
    $type: "color",
    primary: { $value: { colorSpace: "srgb", components: [1, 0, 0] } },
  },
});

const BLUE = JSON.stringify({
  color: {
    $type: "color",
    primary: { $value: { colorSpace: "srgb", components: [0, 0, 1] } },
  },
});

const SECONDARY = JSON.stringify({
  color: {
    $type: "color",
    secondary: { $value: { colorSpace: "srgb", components: [0, 1, 0] } },
  },
});

describe("WorkspaceIndex", () => {
  it("upserts a file and finds its tokens by path", async () => {
    const index = new WorkspaceIndex();
    const analysis = await analyze(RED);
    index.upsert("file:///a.tokens.json", analysis);

    const hits = index.lookup("color.primary");
    expect(hits).toHaveLength(1);
    expect(hits[0]?.uri).toBe("file:///a.tokens.json");
    expect(hits[0]?.token.path).toBe("color.primary");
  });

  it("returns an empty array for a path with no matches", async () => {
    const index = new WorkspaceIndex();
    index.upsert("file:///a.tokens.json", await analyze(RED));

    expect(index.lookup("color.nonexistent")).toEqual([]);
  });

  it("excludes the given uri from lookup results", async () => {
    const index = new WorkspaceIndex();
    index.upsert("file:///a.tokens.json", await analyze(RED));

    expect(index.lookup("color.primary", "file:///a.tokens.json")).toEqual([]);
  });

  it("returns matches from multiple files sorted by uri", async () => {
    const index = new WorkspaceIndex();
    index.upsert("file:///b.tokens.json", await analyze(BLUE));
    index.upsert("file:///a.tokens.json", await analyze(RED));

    const hits = index.lookup("color.primary");
    expect(hits).toHaveLength(2);
    expect(hits.map((h) => h.uri)).toEqual([
      "file:///a.tokens.json",
      "file:///b.tokens.json",
    ]);
  });

  it("empties out after remove()", async () => {
    const index = new WorkspaceIndex();
    index.upsert("file:///a.tokens.json", await analyze(RED));
    expect(index.has("file:///a.tokens.json")).toBe(true);

    index.remove("file:///a.tokens.json");

    expect(index.has("file:///a.tokens.json")).toBe(false);
    expect(index.lookup("color.primary")).toEqual([]);
    expect(index.allTokens()).toEqual([]);
  });

  it("replaces old tokens when upserting an existing uri with new content", async () => {
    const index = new WorkspaceIndex();
    index.upsert("file:///a.tokens.json", await analyze(RED));
    expect(index.lookup("color.primary")).toHaveLength(1);

    index.upsert("file:///a.tokens.json", await analyze(SECONDARY));

    expect(index.lookup("color.primary")).toEqual([]);
    const hits = index.lookup("color.secondary");
    expect(hits).toHaveLength(1);
    expect(hits[0]?.uri).toBe("file:///a.tokens.json");
  });

  it("allTokens() reports tokens across all indexed files", async () => {
    const index = new WorkspaceIndex();
    index.upsert("file:///a.tokens.json", await analyze(RED));
    index.upsert("file:///b.tokens.json", await analyze(SECONDARY));

    const all = index.allTokens();
    expect(all).toHaveLength(2);
    const paths = all.map((t) => t.token.path).sort();
    expect(paths).toEqual(["color.primary", "color.secondary"]);
  });
});
