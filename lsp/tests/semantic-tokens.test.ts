import { describe, expect, it } from "vitest";
import { analyze } from "../src/analyzer.ts";
import {
  semanticTokensFull,
  semanticTokensLegend,
} from "../src/handlers/semantic-tokens.ts";

// Reverses the LSP relative encoding (deltaLine, deltaChar, length, type,
// modifiers) into absolute, human-readable tokens using the legend.
function decodeSemanticTokens(data: number[]): Array<{
  line: number;
  character: number;
  length: number;
  type: string;
  modifiers: string[];
}> {
  const out: Array<{
    line: number;
    character: number;
    length: number;
    type: string;
    modifiers: string[];
  }> = [];
  let line = 0;
  let character = 0;
  for (let i = 0; i < data.length; i += 5) {
    const deltaLine = data[i]!;
    const deltaChar = data[i + 1]!;
    const length = data[i + 2]!;
    const typeIdx = data[i + 3]!;
    const modBits = data[i + 4]!;
    if (deltaLine > 0) {
      line += deltaLine;
      character = deltaChar;
    } else {
      character += deltaChar;
    }
    const modifiers = semanticTokensLegend.tokenModifiers.filter(
      (_, idx) => (modBits & (1 << idx)) !== 0,
    );
    out.push({
      line,
      character,
      length,
      type: semanticTokensLegend.tokenTypes[typeIdx]!,
      modifiers,
    });
  }
  return out;
}

describe("semanticTokensFull", () => {
  it("classifies a group key as namespace and a token key as property+declaration", async () => {
    const text = JSON.stringify(
      {
        color: {
          $type: "color",
          primary: {
            $value: { colorSpace: "srgb", components: [1, 0, 0], hex: "#ff0000" },
          },
        },
      },
      null,
      2,
    );
    const analysis = await analyze(text);
    const tokens = decodeSemanticTokens(semanticTokensFull(analysis).data);

    const colorToken = tokens.find((t) => t.type === "namespace");
    expect(colorToken).toBeDefined();

    const primaryToken = tokens.find(
      (t) => t.type === "property" && t.modifiers.includes("declaration"),
    );
    expect(primaryToken).toBeDefined();
    expect(primaryToken?.modifiers).not.toContain("deprecated");
  });

  it("adds the deprecated modifier for a token with $deprecated: true", async () => {
    const text = JSON.stringify(
      {
        color: {
          $type: "color",
          legacy: {
            $value: { colorSpace: "srgb", components: [1, 0, 0], hex: "#ff0000" },
            $deprecated: true,
          },
        },
      },
      null,
      2,
    );
    const analysis = await analyze(text);
    const tokens = decodeSemanticTokens(semanticTokensFull(analysis).data);

    const legacyToken = tokens.find(
      (t) => t.type === "property" && t.modifiers.includes("declaration"),
    );
    expect(legacyToken).toBeDefined();
    expect(legacyToken?.modifiers).toContain("deprecated");
  });

  it("marks an alias with a resolvable target as variable+reference, no unresolved", async () => {
    const text = JSON.stringify(
      {
        color: {
          $type: "color",
          primary: {
            $value: { colorSpace: "srgb", components: [1, 0, 0], hex: "#ff0000" },
          },
          accent: { $value: "{color.primary}" },
        },
      },
      null,
      2,
    );
    const analysis = await analyze(text);
    const tokens = decodeSemanticTokens(semanticTokensFull(analysis).data);

    const alias = tokens.find((t) => t.type === "variable");
    expect(alias).toBeDefined();
    expect(alias?.modifiers).toContain("reference");
    expect(alias?.modifiers).not.toContain("unresolved");
  });

  it("marks an alias to a missing target as unresolved, unless a workspace callback rescues it", async () => {
    const text = JSON.stringify(
      {
        color: {
          $type: "color",
          accent: { $value: "{color.missing}" },
        },
      },
      null,
      2,
    );
    const analysis = await analyze(text);

    const withoutCallback = decodeSemanticTokens(semanticTokensFull(analysis).data);
    const aliasNoCallback = withoutCallback.find((t) => t.type === "variable");
    expect(aliasNoCallback).toBeDefined();
    expect(aliasNoCallback?.modifiers).toContain("unresolved");

    const withCallback = decodeSemanticTokens(
      semanticTokensFull(analysis, () => true).data,
    );
    const aliasWithCallback = withCallback.find((t) => t.type === "variable");
    expect(aliasWithCallback).toBeDefined();
    expect(aliasWithCallback?.modifiers).not.toContain("unresolved");
  });

  it("classifies a $ref value string as variable+reference", async () => {
    const text = JSON.stringify(
      {
        color: {
          $type: "color",
          primary: {
            $value: { colorSpace: "srgb", components: [1, 0, 0], hex: "#ff0000" },
          },
          aliasRef: { $type: "color", $ref: "#/color/primary/$value" },
        },
      },
      null,
      2,
    );
    const analysis = await analyze(text);
    const tokens = decodeSemanticTokens(semanticTokensFull(analysis).data);

    const refToken = tokens.find((t) => t.type === "variable" && t.modifiers.includes("reference"));
    expect(refToken).toBeDefined();
  });

  it("classifies a $type value as enumMember", async () => {
    const text = JSON.stringify(
      {
        color: {
          $type: "color",
          primary: {
            $value: { colorSpace: "srgb", components: [1, 0, 0], hex: "#ff0000" },
          },
        },
      },
      null,
      2,
    );
    const analysis = await analyze(text);
    const tokens = decodeSemanticTokens(semanticTokensFull(analysis).data);

    const typeTokens = tokens.filter((t) => t.type === "enumMember");
    expect(typeTokens.length).toBeGreaterThan(0);
  });

  it("classifies a mode key under $extensions.tic-tac-token.modes as enumMember+declaration", async () => {
    const text = JSON.stringify(
      {
        color: {
          $type: "color",
          primary: {
            $value: { colorSpace: "srgb", components: [1, 0, 0], hex: "#ff0000" },
            $extensions: {
              "tic-tac-token.modes": {
                dark: { colorSpace: "srgb", components: [0, 0, 0], hex: "#000000" },
              },
            },
          },
        },
      },
      null,
      2,
    );
    const analysis = await analyze(text);
    const tokens = decodeSemanticTokens(semanticTokensFull(analysis).data);

    const modeToken = tokens.find(
      (t) => t.type === "enumMember" && t.modifiers.includes("declaration"),
    );
    expect(modeToken).toBeDefined();
  });

  it("emits data in strictly increasing (line, character) order", async () => {
    const text = JSON.stringify(
      {
        color: {
          $type: "color",
          primary: {
            $value: { colorSpace: "srgb", components: [1, 0, 0], hex: "#ff0000" },
            $extensions: {
              "tic-tac-token.modes": {
                dark: { colorSpace: "srgb", components: [0, 0, 0], hex: "#000000" },
              },
            },
          },
          accent: { $value: "{color.primary}" },
        },
      },
      null,
      2,
    );
    const analysis = await analyze(text);
    const tokens = decodeSemanticTokens(semanticTokensFull(analysis).data);

    expect(tokens.length).toBeGreaterThan(1);
    for (let i = 1; i < tokens.length; i++) {
      const prev = tokens[i - 1]!;
      const cur = tokens[i]!;
      const increasing =
        cur.line > prev.line || (cur.line === prev.line && cur.character > prev.character);
      expect(increasing).toBe(true);
    }
  });

  it("trims quotes from key ranges and keeps quotes on alias value ranges", async () => {
    const text = JSON.stringify(
      {
        color: {
          $type: "color",
          primary: {
            $value: { colorSpace: "srgb", components: [1, 0, 0], hex: "#ff0000" },
          },
          accent: { $value: "{color.primary}" },
        },
      },
      null,
      2,
    );
    const analysis = await analyze(text);
    const tokens = decodeSemanticTokens(semanticTokensFull(analysis).data);

    // "primary" key: quote-trimmed, so length equals the bare word length.
    const primaryLine = text.split("\n").findIndex((l) => l.includes('"primary"'));
    const primaryChar = text.split("\n")[primaryLine]!.indexOf('"primary"') + 1;
    const primaryToken = tokens.find(
      (t) => t.line === primaryLine && t.character === primaryChar,
    );
    expect(primaryToken).toBeDefined();
    expect(primaryToken?.length).toBe("primary".length);

    // Alias value `"{color.primary}"`: full node including quotes.
    const aliasLine = text.split("\n").findIndex((l) => l.includes('"{color.primary}"'));
    const aliasChar = text.split("\n")[aliasLine]!.indexOf('"{color.primary}"');
    const aliasToken = tokens.find((t) => t.line === aliasLine && t.character === aliasChar);
    expect(aliasToken).toBeDefined();
    expect(aliasToken?.length).toBe('"{color.primary}"'.length);
  });
});
