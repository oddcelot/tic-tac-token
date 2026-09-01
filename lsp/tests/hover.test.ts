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

// Regression guard for the `$extensions.tic-tac-token.modes` scoped hover
// added in 22667a1: hovering inside a mode block must resolve to the
// `<path>@<mode>` variant token (its own value), not fall back to the
// parent token, and the highlight range must be pinned to the mode block.
describe("hoverAt over mode variants", () => {
  const MODE_TEXT = JSON.stringify(
    {
      color: {
        $type: "color",
        accent: {
          $value: {
            colorSpace: "srgb",
            components: [1, 0.4, 0.5],
            hex: "#ff6680",
          },
          $extensions: {
            "tic-tac-token.modes": {
              dark: {
                colorSpace: "srgb",
                components: [1, 0.56, 0.64],
                hex: "#ff8fa3",
              },
            },
          },
        },
      },
    },
    null,
    2,
  );

  it("resolves the mode-variant token when hovering inside the mode block", async () => {
    const analysis = await analyze(MODE_TEXT);
    // "#ff8fa3" only appears inside the dark mode block.
    const hover = hoverAt(analysis, lineCharOf(MODE_TEXT, '"#ff8fa3"'));
    expect(hover).toBeDefined();
    const md = (hover?.contents as { value: string }).value;
    expect(md).toContain("color.accent@dark");
    expect(md).toContain("#ff8fa3");
    // Must NOT show the base value.
    expect(md).not.toContain("#ff6680");
  });

  it("pins the hover range to the mode block, not the whole token", async () => {
    const analysis = await analyze(MODE_TEXT);
    const hover = hoverAt(analysis, lineCharOf(MODE_TEXT, '"#ff8fa3"'));
    const range = hover!.range!;
    // The dark block opens after `"dark":` and is a handful of lines —
    // it must not span the entire accent token (which starts much earlier).
    const accentLine = lineCharOf(MODE_TEXT, '"accent"').line;
    const darkLine = lineCharOf(MODE_TEXT, '"dark"').line;
    expect(range.start.line).toBe(darkLine);
    expect(range.start.line).toBeGreaterThan(accentLine);
  });

  it("still resolves the base token when hovering its own $value", async () => {
    const analysis = await analyze(MODE_TEXT);
    const hover = hoverAt(analysis, lineCharOf(MODE_TEXT, '"#ff6680"'));
    const md = (hover?.contents as { value: string }).value;
    expect(md).toContain("color.accent");
    expect(md).not.toContain("@dark");
    expect(md).toContain("#ff6680");
  });
});
