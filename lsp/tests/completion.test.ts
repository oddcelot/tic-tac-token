import { describe, expect, it } from "vitest";
import { analyze } from "../src/analyzer.ts";
import { completionsAt } from "../src/handlers/completion.ts";

const TEXT = JSON.stringify(
  {
    color: {
      $type: "color",
      neutral: {
        text: {
          $value: {
            colorSpace: "srgb",
            components: [0, 0, 0],
            alpha: 1,
            hex: "#000000",
          },
        },
        background: {
          $value: {
            colorSpace: "srgb",
            components: [1, 1, 1],
            alpha: 1,
            hex: "#ffffff",
          },
        },
        border: { $value: "{color.neutral.text}" },
      },
    },
    space: {
      md: { $type: "dimension", $value: { value: 16, unit: "px" } },
    },
  },
  null,
  2,
);

function positionOf(needle: string, offsetFromMatch = 0) {
  const idx = TEXT.indexOf(needle);
  if (idx < 0) throw new Error(`needle not found: ${needle}`);
  const target = idx + needle.length + offsetFromMatch;
  const before = TEXT.slice(0, target);
  const line = (before.match(/\n/g) ?? []).length;
  const lastNewline = before.lastIndexOf("\n");
  return { line, character: target - (lastNewline + 1) };
}

describe("completionsAt", () => {
  it("suggests all tokens at an empty alias `{`", async () => {
    // Insert a fresh open-alias and request completions just past the `{`.
    const text = TEXT.replace(
      '"{color.neutral.text}"',
      '"{"',
    );
    const analysis = await analyze(text);
    const idx = text.indexOf('"{') + 2;
    const before = text.slice(0, idx);
    const line = (before.match(/\n/g) ?? []).length;
    const character = idx - (before.lastIndexOf("\n") + 1);
    const result = completionsAt(analysis, { line, character });
    const labels = result.items.map((i) => i.label);
    expect(labels).toContain("color.neutral.text");
    expect(labels).toContain("color.neutral.background");
    expect(labels).toContain("space.md");
  });

  it("filters by path prefix", async () => {
    // Source has `"{color.neutral.text}"`. Place cursor just after the
    // `.` in `color.neutral.` (i.e. before `text`).
    const text = TEXT;
    const aliasIdx = text.indexOf("{color.neutral.text}");
    const dotIdx = text.indexOf("neutral.", aliasIdx) + "neutral.".length;
    const before = text.slice(0, dotIdx);
    const line = (before.match(/\n/g) ?? []).length;
    const character = dotIdx - (before.lastIndexOf("\n") + 1);
    const analysis = await analyze(text);
    const result = completionsAt(analysis, { line, character });
    const labels = result.items.map((i) => i.label);
    expect(labels).toContain("color.neutral.text");
    expect(labels).toContain("color.neutral.background");
    // Things outside the prefix should be filtered out
    expect(labels).not.toContain("space.md");
  });

  it("returns empty completions when the cursor is outside any alias", async () => {
    const analysis = await analyze(TEXT);
    const result = completionsAt(analysis, { line: 0, character: 0 });
    expect(result.items).toEqual([]);
  });

  it("annotates each suggestion with the target token's $type", async () => {
    const text = TEXT.replace(
      '"{color.neutral.text}"',
      '"{"',
    );
    const analysis = await analyze(text);
    const idx = text.indexOf('"{') + 2;
    const before = text.slice(0, idx);
    const line = (before.match(/\n/g) ?? []).length;
    const character = idx - (before.lastIndexOf("\n") + 1);
    const result = completionsAt(analysis, { line, character });
    const space = result.items.find((i) => i.label === "space.md");
    expect(space?.detail).toBe("dimension");
    const colorText = result.items.find((i) => i.label === "color.neutral.text");
    expect(colorText?.detail).toBe("color");
  });

  it("suggests JSON pointers inside a $ref string", async () => {
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
          aliasRef: { $type: "color", $ref: "" },
        },
      },
      null,
      2,
    );
    const analysis = await analyze(text);
    // Position cursor inside the empty `$ref` string between the quotes.
    const refIdx = text.indexOf('"$ref": "') + '"$ref": "'.length;
    const before = text.slice(0, refIdx);
    const line = (before.match(/\n/g) ?? []).length;
    const character = refIdx - (before.lastIndexOf("\n") + 1);
    const result = completionsAt(analysis, { line, character });
    const labels = result.items.map((i) => i.label);
    expect(labels).toContain("#/color/primary/$value");
    // Token-root $ref tokens have no $value in source → not a valid pointer target
    expect(labels).not.toContain("#/color/aliasRef/$value");
  });

  it("filters $ref suggestions by pointer prefix", async () => {
    const text = JSON.stringify(
      {
        color: {
          neutral: {
            $type: "color",
            text: {
              $value: {
                colorSpace: "srgb",
                components: [0, 0, 0],
                alpha: 1,
                hex: "#000000",
              },
            },
          },
          ref: { $type: "color", $ref: "#/color/n" },
        },
      },
      null,
      2,
    );
    const analysis = await analyze(text);
    const target = text.indexOf("#/color/n") + "#/color/n".length;
    const before = text.slice(0, target);
    const line = (before.match(/\n/g) ?? []).length;
    const character = target - (before.lastIndexOf("\n") + 1);
    const result = completionsAt(analysis, { line, character });
    const labels = result.items.map((i) => i.label);
    expect(labels).toContain("#/color/neutral/text/$value");
  });

  it("provides a textEdit that replaces the in-flight alias body", async () => {
    const text = TEXT;
    const aliasIdx = text.indexOf("{color.neutral.text}");
    const dotIdx = text.indexOf("neutral.", aliasIdx) + "neutral.".length;
    const before = text.slice(0, dotIdx);
    const line = (before.match(/\n/g) ?? []).length;
    const character = dotIdx - (before.lastIndexOf("\n") + 1);
    const analysis = await analyze(text);
    const result = completionsAt(analysis, { line, character });
    const item = result.items.find((i) => i.label === "color.neutral.text");
    expect(item).toBeDefined();
    expect(item?.textEdit).toBeDefined();
    expect("range" in (item?.textEdit ?? {})).toBe(true);
  });
});
