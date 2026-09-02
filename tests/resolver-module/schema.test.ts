import { describe, expect, it } from "vitest";
import { resolveResolverDocument } from "../../src/resolver-module/index.ts";

describe("ResolverDocument schema (§4.1)", () => {
  it("accepts a minimal valid document", () => {
    const result = resolveResolverDocument({ version: "2025.10", resolutionOrder: [] });
    expect(result.documentErrors).toEqual([]);
  });

  it("rejects a document missing version", () => {
    const result = resolveResolverDocument({ resolutionOrder: [] });
    expect(result.documentErrors.some((e) => e.kind === "invalid-document")).toBe(true);
  });

  it("rejects a document whose version is not exactly \"2025.10\"", () => {
    const result = resolveResolverDocument({ version: "2024.1", resolutionOrder: [] });
    expect(result.documentErrors.some((e) => e.kind === "invalid-document")).toBe(true);
  });

  it("rejects a document missing resolutionOrder", () => {
    const result = resolveResolverDocument({ version: "2025.10" });
    expect(result.documentErrors.some((e) => e.kind === "invalid-document")).toBe(true);
  });

  it("accepts optional sets, modifiers, name, and description", () => {
    const result = resolveResolverDocument({
      version: "2025.10",
      resolutionOrder: [],
      name: "My Resolver",
      description: "A description",
      sets: {},
      modifiers: {},
    });
    expect(result.documentErrors).toEqual([]);
  });

  it("accepts and ignores $defs", () => {
    const result = resolveResolverDocument({
      version: "2025.10",
      resolutionOrder: [],
      $defs: {
        base: {
          color: {
            $type: "color",
            $value: { colorSpace: "srgb", components: [0, 0, 0], alpha: 1, hex: "#000000" },
          },
        },
      },
    });
    expect(result.documentErrors).toEqual([]);
  });

  it("rejects an unknown root key", () => {
    const result = resolveResolverDocument({
      version: "2025.10",
      resolutionOrder: [],
      unknownKey: true,
    });
    expect(result.documentErrors.some((e) => e.kind === "invalid-document")).toBe(true);
  });
});
