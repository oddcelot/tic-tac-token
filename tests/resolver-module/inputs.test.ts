import { describe, expect, it } from "vitest";
import { resolveResolverDocument } from "../../src/resolver-module/index.ts";

const color = (r: number, g: number, b: number, hex: string) => ({
  $type: "color" as const,
  $value: { colorSpace: "srgb", components: [r, g, b], alpha: 1, hex },
});

// A single-modifier document with mixed-case context names, used across
// most cases below; `overrides` merges into the resolutionOrder entry.
const themeDoc = (overrides: Record<string, unknown> = {}) => ({
  version: "2025.10",
  resolutionOrder: [
    {
      name: "theme",
      type: "modifier",
      contexts: {
        Light: [{ color: { bg: color(1, 1, 1, "#ffffff") } }],
        Dark: [{ color: { bg: color(0, 0, 0, "#000000") } }],
      },
      ...overrides,
    },
  ],
});

const inputErrorKinds = ["unknown-input-key", "invalid-input-value", "missing-required-input"];

describe("resolver module input validation (§6.1)", () => {
  it("matches input key and context value case-insensitively", () => {
    const result = resolveResolverDocument(themeDoc(), { theme: "dark" });
    expect(result.documentErrors.filter((e) => inputErrorKinds.includes(e.kind))).toEqual([]);
    expect(result.tokens.byPath.get("color.bg")?.$value).toMatchObject({ hex: "#000000" });
  });

  it("reports unknown-input-key for an input naming no modifier", () => {
    const result = resolveResolverDocument(themeDoc({ default: "Light" }), { color: "red" });
    const errors = result.documentErrors.filter((e) => e.kind === "unknown-input-key");
    expect(errors).toHaveLength(1);
    expect(errors[0]?.at).toBe("inputs.color");
  });

  it("reports invalid-input-value when the input names no context of the modifier", () => {
    const result = resolveResolverDocument(themeDoc({ default: "Light" }), { theme: "sepia" });
    const errors = result.documentErrors.filter((e) => e.kind === "invalid-input-value");
    expect(errors).toHaveLength(1);
    expect(errors[0]?.at).toBe("inputs.theme");
  });

  it("reports invalid-input-value for a non-string input value", () => {
    const result = resolveResolverDocument(themeDoc({ default: "Light" }), {
      theme: 123 as never,
    });
    const errors = result.documentErrors.filter((e) => e.kind === "invalid-input-value");
    expect(errors).toHaveLength(1);
    expect(errors[0]?.at).toBe("inputs.theme");
  });

  it("reports missing-required-input for a modifier with no default and no input", () => {
    const result = resolveResolverDocument(themeDoc());
    const errors = result.documentErrors.filter((e) => e.kind === "missing-required-input");
    expect(errors).toHaveLength(1);
    expect(errors[0]?.at).toBe("resolutionOrder[0]");
  });

  it("uses the default context when a modifier has a default and no input is supplied", () => {
    const result = resolveResolverDocument(themeDoc({ default: "Light" }));
    expect(result.documentErrors.filter((e) => e.kind === "missing-required-input")).toEqual([]);
    expect(result.tokens.byPath.get("color.bg")?.$value).toMatchObject({ hex: "#ffffff" });
  });

  it("produces no errors when the document declares no modifiers and no inputs are supplied", () => {
    const result = resolveResolverDocument({
      version: "2025.10",
      resolutionOrder: [
        {
          name: "base",
          type: "set",
          sources: [{ color: { bg: color(0, 0, 0, "#000000") } }],
        },
      ],
    });
    expect(result.documentErrors).toEqual([]);
  });
});
