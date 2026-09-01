import { describe, expect, it } from "vitest";
import { resolveResolverDocument } from "../../src/resolver-module/index.ts";

const color = (r: number, g: number, b: number, hex: string) => ({
  $type: "color" as const,
  $value: { colorSpace: "srgb", components: [r, g, b], alpha: 1, hex },
});

describe("resolver module resolutionOrder validation (§6.2, §4.1.5.1)", () => {
  it("reports duplicate-name when two resolutionOrder entries share a name", () => {
    const result = resolveResolverDocument({
      version: "2025.10",
      resolutionOrder: [
        {
          name: "base",
          type: "set",
          sources: [{ color: { bg: color(0, 0, 0, "#000000") } }],
        },
        {
          name: "base",
          type: "set",
          sources: [{ color: { bg: color(1, 1, 1, "#ffffff") } }],
        },
      ],
    });
    const errors = result.documentErrors.filter((e) => e.kind === "duplicate-name");
    expect(errors).toHaveLength(1);
    expect(errors[0]?.at).toBe("resolutionOrder[1]");
  });

  it("reports missing-name-or-type when an inline entry has no name", () => {
    const result = resolveResolverDocument({
      version: "2025.10",
      resolutionOrder: [{ type: "set", sources: [] }],
    });
    const errors = result.documentErrors.filter((e) => e.kind === "missing-name-or-type");
    expect(errors).toHaveLength(1);
    expect(errors[0]?.at).toBe("resolutionOrder[0]");
  });

  it("reports missing-name-or-type when an inline entry has no type", () => {
    const result = resolveResolverDocument({
      version: "2025.10",
      resolutionOrder: [{ name: "base", sources: [] }],
    });
    const errors = result.documentErrors.filter((e) => e.kind === "missing-name-or-type");
    expect(errors).toHaveLength(1);
    expect(errors[0]?.at).toBe("resolutionOrder[0]");
  });

  it("reports missing-name-or-type when an inline entry has neither name nor type", () => {
    const result = resolveResolverDocument({
      version: "2025.10",
      resolutionOrder: [{}],
    });
    const errors = result.documentErrors.filter((e) => e.kind === "missing-name-or-type");
    expect(errors).toHaveLength(1);
    expect(errors[0]?.at).toBe("resolutionOrder[0]");
  });

  it("reports invalid-pointer for a $ref that isn't #/sets/<name> or #/modifiers/<name>", () => {
    const result = resolveResolverDocument({
      version: "2025.10",
      resolutionOrder: [{ $ref: "#/$defs/foo" }],
    });
    const errors = result.documentErrors.filter((e) => e.kind === "invalid-pointer");
    expect(errors).toHaveLength(1);
    expect(errors[0]?.at).toBe("resolutionOrder[0]");
    expect(errors[0]?.target).toBe("#/$defs/foo");
  });

  it("reports invalid-pointer when $ref names an undeclared set or modifier", () => {
    const result = resolveResolverDocument({
      version: "2025.10",
      resolutionOrder: [{ $ref: "#/sets/missing" }],
    });
    const errors = result.documentErrors.filter((e) => e.kind === "invalid-pointer");
    expect(errors).toHaveLength(1);
    expect(errors[0]?.at).toBe("resolutionOrder[0]");
    expect(errors[0]?.target).toBe("#/sets/missing");
  });

  it("reports modifier-no-contexts for an empty contexts map", () => {
    const result = resolveResolverDocument({
      version: "2025.10",
      resolutionOrder: [{ name: "theme", type: "modifier", contexts: {} }],
    });
    const errors = result.documentErrors.filter((e) => e.kind === "modifier-no-contexts");
    expect(errors).toHaveLength(1);
    expect(errors[0]?.at).toBe("resolutionOrder[0]");
  });

  it("reports modifier-single-context for exactly one context", () => {
    const result = resolveResolverDocument({
      version: "2025.10",
      resolutionOrder: [
        {
          name: "theme",
          type: "modifier",
          contexts: { light: [{ color: { bg: color(1, 1, 1, "#ffffff") } }] },
        },
      ],
    });
    const errors = result.documentErrors.filter((e) => e.kind === "modifier-single-context");
    expect(errors).toHaveLength(1);
    expect(errors[0]?.at).toBe("resolutionOrder[0]");
  });

  it("reports invalid-default when default names no declared context", () => {
    const result = resolveResolverDocument({
      version: "2025.10",
      resolutionOrder: [
        {
          name: "theme",
          type: "modifier",
          default: "sepia",
          contexts: {
            light: [{ color: { bg: color(1, 1, 1, "#ffffff") } }],
            dark: [{ color: { bg: color(0, 0, 0, "#000000") } }],
          },
        },
      ],
    });
    const errors = result.documentErrors.filter((e) => e.kind === "invalid-default");
    expect(errors).toHaveLength(1);
    expect(errors[0]?.at).toBe("resolutionOrder[0]");
  });
});
