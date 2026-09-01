import { describe, expect, it } from "vitest";
import { analyze } from "../src/analyzer.ts";
import {
  colorPresentations,
  documentColors,
} from "../src/handlers/document-color.ts";
import { WorkspaceIndex } from "../src/workspace/index.ts";
import { lineCharOf } from "./helpers.ts";

// Slice a range out of the source text so assertions read against the
// actual highlighted span rather than raw offsets.
function textOfRange(
  text: string,
  range: { start: { line: number; character: number }; end: { line: number; character: number } },
): string {
  const lines = text.split("\n");
  if (range.start.line === range.end.line) {
    return lines[range.start.line]!.slice(range.start.character, range.end.character);
  }
  const out: string[] = [lines[range.start.line]!.slice(range.start.character)];
  for (let i = range.start.line + 1; i < range.end.line; i++) out.push(lines[i]!);
  out.push(lines[range.end.line]!.slice(0, range.end.character));
  return out.join("\n");
}

describe("documentColors", () => {
  it("swatches a hex color on its hex string", async () => {
    const text = JSON.stringify(
      { color: { $type: "color", primary: { $value: { colorSpace: "srgb", components: [1, 0, 0], hex: "#ff0000" } } } },
      null,
      2,
    );
    const infos = documentColors(await analyze(text));
    expect(infos).toHaveLength(1);
    expect(infos[0]!.color).toMatchObject({ red: 1, green: 0, blue: 0, alpha: 1 });
    expect(textOfRange(text, infos[0]!.range)).toBe('"#ff0000"');
  });

  it("swatches the whole $value object when there is no hex", async () => {
    const text = JSON.stringify(
      { color: { $type: "color", primary: { $value: { colorSpace: "srgb", components: [0, 0, 1] } } } },
      null,
      2,
    );
    const infos = documentColors(await analyze(text));
    expect(infos).toHaveLength(1);
    expect(infos[0]!.color).toMatchObject({ red: 0, green: 0, blue: 1 });
    expect(textOfRange(text, infos[0]!.range).startsWith("{")).toBe(true);
  });

  it("swatches an alias string that resolves to a color", async () => {
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
    const infos = documentColors(await analyze(text));
    // one for primary's hex, one for the accent alias
    expect(infos).toHaveLength(2);
    const aliasInfo = infos.find((i) => textOfRange(text, i.range) === '"{color.primary}"');
    expect(aliasInfo).toBeDefined();
    expect(aliasInfo!.color).toMatchObject({ red: 1, green: 0, blue: 0 });
  });

  it("swatches a $ref string that resolves to a color", async () => {
    const text = JSON.stringify(
      {
        color: {
          $type: "color",
          primary: { $value: { colorSpace: "srgb", components: [0, 1, 0], hex: "#00ff00" } },
          accent: { $ref: "#/color/primary/$value" },
        },
      },
      null,
      2,
    );
    const infos = documentColors(await analyze(text));
    const refInfo = infos.find((i) => textOfRange(text, i.range) === '"#/color/primary/$value"');
    expect(refInfo).toBeDefined();
    expect(refInfo!.color).toMatchObject({ red: 0, green: 1, blue: 0 });
  });

  it("does not swatch an alias to a broken/unknown target", async () => {
    const text = JSON.stringify(
      { color: { $type: "color", accent: { $value: "{color.missing}" } } },
      null,
      2,
    );
    const infos = documentColors(await analyze(text));
    expect(infos).toHaveLength(0);
  });

  it("does not swatch an alias to a non-color token", async () => {
    const text = JSON.stringify(
      {
        space: { $type: "dimension", md: { $value: { value: 8, unit: "px" } } },
        color: { $type: "color", weird: { $value: "{space.md}" } },
      },
      null,
      2,
    );
    const infos = documentColors(await analyze(text));
    expect(infos).toHaveLength(0);
  });

  it("resolves an alias to a color defined in another workspace file", async () => {
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
    const index = new WorkspaceIndex();
    index.upsert("file:///base.tokens.json", await analyze(baseText));
    const usage = await analyze(usageText);
    index.upsert("file:///usage.tokens.json", usage);

    const infos = documentColors(usage, index, "file:///usage.tokens.json");
    expect(infos).toHaveLength(1);
    expect(textOfRange(usageText, infos[0]!.range)).toBe('"{color.primary}"');
    expect(infos[0]!.color).toMatchObject({ red: 1, green: 0, blue: 0 });
  });

  it("swatches a mode-variant color value", async () => {
    const text = JSON.stringify(
      {
        color: {
          $type: "color",
          bg: {
            $value: { colorSpace: "srgb", components: [1, 1, 1], hex: "#ffffff" },
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
    const infos = documentColors(await analyze(text));
    const darkHex = infos.filter((i) => textOfRange(text, i.range) === '"#000000"');
    expect(darkHex).toHaveLength(1);
    expect(darkHex[0]!.color).toMatchObject({ red: 0, green: 0, blue: 0 });
  });
});

describe("colorPresentations", () => {
  it("returns a hex label and no textEdit", () => {
    const pres = colorPresentations({ red: 1, green: 0, blue: 0, alpha: 1 });
    expect(pres).toEqual([{ label: "#ff0000" }]);
    expect(pres[0]).not.toHaveProperty("textEdit");
  });
});
