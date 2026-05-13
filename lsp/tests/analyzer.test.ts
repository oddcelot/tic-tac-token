import { describe, expect, it } from "vitest";
import { analyze } from "../src/analyzer.ts";

const VALID = JSON.stringify(
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

describe("analyze", () => {
  it("returns no validation issues for a valid document", async () => {
    const result = await analyze(VALID);
    expect(result.syntaxErrors).toEqual([]);
    expect(result.validationIssues).toEqual([]);
    expect(result.resolved.errors).toEqual([]);
    expect(result.resolved.tokens).toHaveLength(1);
  });

  it("flags syntax errors", async () => {
    const result = await analyze('{ "color": { "$type": "color" '); // missing braces
    expect(result.syntaxErrors.length).toBeGreaterThan(0);
  });

  it("flags arktype validation issues", async () => {
    const result = await analyze(
      JSON.stringify({
        color: {
          primary: { $type: "color", $value: "not-a-color-object" },
        },
      }),
    );
    expect(result.validationIssues.length).toBeGreaterThan(0);
  });

  it("flags resolver errors (broken alias)", async () => {
    const result = await analyze(
      JSON.stringify({
        color: {
          accent: { $type: "color", $value: "{color.missing}" },
        },
      }),
    );
    expect(result.resolved.errors.some((e) => e.kind === "broken-alias")).toBe(true);
  });

  it("returns an empty result for an empty document", async () => {
    const result = await analyze("");
    expect(result.value).toBeUndefined();
    expect(result.validationIssues).toEqual([]);
    expect(result.resolved.tokens).toEqual([]);
  });
});
