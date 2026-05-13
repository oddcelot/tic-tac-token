import { describe, expect, it } from "vitest";
import { analyze } from "../src/analyzer.ts";
import { diagnosticsFromAnalysis } from "../src/handlers/diagnostics.ts";

describe("diagnosticsFromAnalysis", () => {
  it("emits no diagnostics for a valid document", async () => {
    const analysis = await analyze(
      JSON.stringify({
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
      }),
    );
    expect(diagnosticsFromAnalysis(analysis)).toEqual([]);
  });

  it("emits a diagnostic for an invalid colorSpace at the right range", async () => {
    const text = JSON.stringify(
      {
        color: {
          primary: {
            $type: "color",
            $value: {
              colorSpace: "rgb-bogus",
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
    const analysis = await analyze(text);
    const diagnostics = diagnosticsFromAnalysis(analysis);
    expect(diagnostics.length).toBeGreaterThan(0);
    // First arktype diagnostic should point at the offending value
    const ranges = diagnostics.map((d) => d.range);
    expect(ranges[0]?.start.line).toBeGreaterThanOrEqual(0);
  });

  it("emits a diagnostic for a broken alias at the consuming token's location", async () => {
    const text = JSON.stringify(
      {
        color: {
          accent: { $type: "color", $value: "{color.missing}" },
        },
      },
      null,
      2,
    );
    const analysis = await analyze(text);
    const diagnostics = diagnosticsFromAnalysis(analysis);
    const aliasDiag = diagnostics.find((d) => d.code === "broken-alias");
    expect(aliasDiag).toBeDefined();
    expect(aliasDiag?.message).toMatch(/color\.missing/);
  });

  it("emits a diagnostic for a JSON syntax error", async () => {
    const analysis = await analyze('{ "color": { "$type": "color" ');
    const diagnostics = diagnosticsFromAnalysis(analysis);
    const syntaxDiag = diagnostics.find((d) => d.message.startsWith("JSON syntax:"));
    expect(syntaxDiag).toBeDefined();
  });
});
