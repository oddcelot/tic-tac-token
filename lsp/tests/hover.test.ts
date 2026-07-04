import { describe, expect, it } from "vitest";
import { analyze } from "../src/analyzer.ts";
import { hoverAt } from "../src/handlers/hover.ts";
import { lineCharOf } from "./helpers.ts";

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

  it("renders a dimension value as a flat CSS string", async () => {
    const text = JSON.stringify(
      {
        space: { md: { $type: "dimension", $value: { value: 32, unit: "px" } } },
      },
      null,
      2,
    );
    const analysis = await analyze(text);
    const position = lineCharOf(text, '"unit"');
    const hover = hoverAt(analysis, position);
    expect(hover).toBeDefined();
    const md = (hover?.contents as { value: string }).value;
    expect(md).toContain("`32px`");
    expect(md).not.toContain("```json");
  });

  it("renders a duration value as a flat CSS string", async () => {
    const text = JSON.stringify(
      {
        motion: {
          fast: { $type: "duration", $value: { value: 150, unit: "ms" } },
        },
      },
      null,
      2,
    );
    const analysis = await analyze(text);
    const position = lineCharOf(text, '"unit"');
    const md = (hoverAt(analysis, position)?.contents as { value: string }).value;
    expect(md).toContain("`150ms`");
  });

  it("renders cubicBezier as a `cubic-bezier(...)` string", async () => {
    const text = JSON.stringify(
      {
        ease: { $type: "cubicBezier", $value: [0.4, 0, 0.2, 1] },
      },
      null,
      2,
    );
    const analysis = await analyze(text);
    const position = lineCharOf(text, "$value");
    const md = (hoverAt(analysis, position)?.contents as { value: string }).value;
    expect(md).toContain("`cubic-bezier(0.4, 0, 0.2, 1)`");
  });

  it("renders a fontFamily stack as a comma-joined CSS string", async () => {
    const text = JSON.stringify(
      {
        sans: {
          $type: "fontFamily",
          $value: ["Inter", "system-ui", "sans-serif"],
        },
      },
      null,
      2,
    );
    const analysis = await analyze(text);
    const position = lineCharOf(text, "$value");
    const md = (hoverAt(analysis, position)?.contents as { value: string }).value;
    expect(md).toContain("`Inter, system-ui, sans-serif`");
  });

  it("renders a border composite as a flat CSS string", async () => {
    const text = JSON.stringify(
      {
        focus: {
          $type: "border",
          $value: {
            color: { colorSpace: "srgb", components: [1, 0, 0], hex: "#ff0000" },
            width: { value: 2, unit: "px" },
            style: "dashed",
          },
        },
      },
      null,
      2,
    );
    const analysis = await analyze(text);
    const position = lineCharOf(text, "$value");
    const md = (hoverAt(analysis, position)?.contents as { value: string }).value;
    expect(md).toContain("`2px dashed #ff0000`");
  });

  it("renders a single shadow as a flat CSS string", async () => {
    const text = JSON.stringify(
      {
        sm: {
          $type: "shadow",
          $value: {
            color: { colorSpace: "srgb", components: [0, 0, 0], alpha: 0.1, hex: "#000000" },
            offsetX: { value: 0, unit: "px" },
            offsetY: { value: 2, unit: "px" },
            blur: { value: 4, unit: "px" },
            spread: { value: 0, unit: "px" },
          },
        },
      },
      null,
      2,
    );
    const analysis = await analyze(text);
    const position = lineCharOf(text, "$value");
    const md = (hoverAt(analysis, position)?.contents as { value: string }).value;
    expect(md).toContain("`0px 2px 4px 0px #000000`");
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
