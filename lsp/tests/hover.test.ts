import { describe, expect, it } from "vitest";
import { analyze } from "../src/analyzer.ts";
import { hoverAt } from "../src/handlers/hover.ts";

const TEXT = JSON.stringify(
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
      accent: { $value: "{color.primary}" },
    },
  },
  null,
  2,
);

function lineCharOf(text: string, needle: string): { line: number; character: number } {
  const idx = text.indexOf(needle);
  if (idx < 0) throw new Error(`needle not found: ${needle}`);
  const before = text.slice(0, idx);
  const line = (before.match(/\n/g) ?? []).length;
  const lastNewline = before.lastIndexOf("\n");
  const character = idx - (lastNewline + 1);
  return { line, character };
}

describe("hoverAt", () => {
  it("shows the resolved value for a plain color token", async () => {
    const analysis = await analyze(TEXT);
    const position = lineCharOf(TEXT, '"hex"');
    const hover = hoverAt(analysis, position);
    expect(hover).toBeDefined();
    const md = (hover?.contents as { value: string }).value;
    expect(md).toContain("color.primary");
    expect(md).toContain("color");
    expect(md).toContain("#ff0000");
  });

  it("shows both literal and resolved values for an alias", async () => {
    const analysis = await analyze(TEXT);
    const position = lineCharOf(TEXT, '"{color.primary}"');
    const hover = hoverAt(analysis, position);
    expect(hover).toBeDefined();
    const md = (hover?.contents as { value: string }).value;
    expect(md).toContain("color.accent");
    expect(md).toContain("**Value**");
    expect(md).toContain("**Resolved**");
    expect(md).toContain("#ff0000");
  });

  it("returns undefined when the cursor is outside any token", async () => {
    const analysis = await analyze(TEXT);
    const hover = hoverAt(analysis, { line: 0, character: 0 });
    expect(hover).toBeUndefined();
  });

  it("shows literal pointer + resolved value for a token-root $ref token", async () => {
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
          aliasRef: {
            $type: "color",
            $ref: "#/color/primary/$value",
          },
        },
      },
      null,
      2,
    );
    const analysis = await analyze(text);
    const position = lineCharOf(text, '"#/color/primary/$value"');
    const hover = hoverAt(analysis, position);
    expect(hover).toBeDefined();
    const md = (hover?.contents as { value: string }).value;
    expect(md).toContain("color.aliasRef");
    expect(md).toContain("#/color/primary/$value");
    expect(md).toContain("**Resolved**");
    expect(md).toContain("#ff0000");
  });
});
