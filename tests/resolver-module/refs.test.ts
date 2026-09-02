import { describe, expect, it } from "vitest";
import { resolveResolverDocument } from "../../src/resolver-module/index.ts";

const dim = (value: number, unit: "px" | "rem" = "px") => ({
  $type: "dimension" as const,
  $value: { value, unit },
});

const color = (r: number, g: number, b: number, hex: string) => ({
  $type: "color" as const,
  $value: { colorSpace: "srgb", components: [r, g, b], alpha: 1, hex },
});

describe("resolver module reference resolution (§4.2, §6.2)", () => {
  it("resolves a same-document $ref from a set source into #/$defs", () => {
    const result = resolveResolverDocument({
      version: "2025.10",
      $defs: {
        colors: { color: { bg: color(0, 0, 0, "#000000") } },
      },
      resolutionOrder: [
        {
          name: "base",
          type: "set",
          sources: [{ $ref: "#/$defs/colors" }],
        },
      ],
    });
    expect(result.documentErrors).toEqual([]);
    expect(result.tokens.byPath.get("color.bg")?.$value).toMatchObject({ hex: "#000000" });
  });

  it("shallow-overrides the target with sibling keys alongside $ref", () => {
    const result = resolveResolverDocument({
      version: "2025.10",
      $defs: {
        colors: {
          color: { bg: color(0, 0, 0, "#000000") },
          size: { md: dim(16) },
        },
      },
      resolutionOrder: [
        {
          name: "base",
          type: "set",
          sources: [
            { $ref: "#/$defs/colors", color: { text: color(1, 1, 1, "#ffffff") } },
          ],
        },
      ],
    });
    expect(result.documentErrors).toEqual([]);
    // Sibling "color" key fully replaces the target's "color" key (shallow merge).
    expect(result.tokens.byPath.get("color.text")?.$value).toMatchObject({ hex: "#ffffff" });
    expect(result.tokens.byPath.has("color.bg")).toBe(false);
    // Untouched sibling key from the target survives.
    expect(result.tokens.byPath.get("size.md")?.$value).toEqual({ value: 16, unit: "px" });
  });

  it("reports invalid-pointer for a dangling $ref", () => {
    const result = resolveResolverDocument({
      version: "2025.10",
      resolutionOrder: [
        {
          name: "base",
          type: "set",
          sources: [{ $ref: "#/$defs/missing" }],
        },
      ],
    });
    const errors = result.documentErrors.filter((e) => e.kind === "invalid-pointer");
    expect(errors).toHaveLength(1);
    expect(errors[0]?.target).toBe("#/$defs/missing");
  });

  it("reports ref-cycle when two same-document refs point at each other", () => {
    const result = resolveResolverDocument({
      version: "2025.10",
      $defs: {
        a: { $ref: "#/$defs/b" },
        b: { $ref: "#/$defs/a" },
      },
      resolutionOrder: [
        {
          name: "base",
          type: "set",
          sources: [{ $ref: "#/$defs/a" }],
        },
      ],
    });
    const errors = result.documentErrors.filter((e) => e.kind === "ref-cycle");
    expect(errors).toHaveLength(1);
  });

  it("reports invalid-reference-target when a set source references a modifier", () => {
    const result = resolveResolverDocument({
      version: "2025.10",
      modifiers: {
        theme: {
          default: "light",
          contexts: {
            light: [{ color: { bg: color(1, 1, 1, "#ffffff") } }],
            dark: [{ color: { bg: color(0, 0, 0, "#000000") } }],
          },
        },
      },
      resolutionOrder: [
        {
          name: "base",
          type: "set",
          sources: [{ $ref: "#/modifiers/theme" }],
        },
      ],
    });
    const errors = result.documentErrors.filter((e) => e.kind === "invalid-reference-target");
    expect(errors).toHaveLength(1);
    expect(errors[0]?.target).toBe("#/modifiers/theme");
  });

  it("reports invalid-pointer when a source ref points into resolutionOrder", () => {
    const result = resolveResolverDocument({
      version: "2025.10",
      resolutionOrder: [
        {
          name: "base",
          type: "set",
          sources: [{ $ref: "#/resolutionOrder/0" }],
        },
      ],
    });
    const errors = result.documentErrors.filter((e) => e.kind === "invalid-pointer");
    expect(errors).toHaveLength(1);
    expect(errors[0]?.target).toBe("#/resolutionOrder/0");
  });

  it("resolves an external document referenced by its whole URI", () => {
    const result = resolveResolverDocument(
      {
        version: "2025.10",
        resolutionOrder: [
          {
            name: "base",
            type: "set",
            sources: [{ $ref: "tokens/base.json" }],
          },
        ],
      },
      {},
      {
        externalDocuments: {
          "tokens/base.json": { color: { bg: color(0, 0, 0, "#000000") } },
        },
      },
    );
    expect(result.documentErrors).toEqual([]);
    expect(result.tokens.byPath.get("color.bg")?.$value).toMatchObject({ hex: "#000000" });
  });

  it("resolves an external document referenced by URI plus fragment", () => {
    const result = resolveResolverDocument(
      {
        version: "2025.10",
        resolutionOrder: [
          {
            name: "base",
            type: "set",
            sources: [{ $ref: "tokens/base.json#/color" }],
          },
        ],
      },
      {},
      {
        externalDocuments: {
          "tokens/base.json": { color: { bg: color(1, 1, 1, "#ffffff") } },
        },
      },
    );
    expect(result.documentErrors).toEqual([]);
    expect(result.tokens.byPath.get("bg")?.$value).toMatchObject({ hex: "#ffffff" });
  });

  it("reports invalid-pointer for a ref to a missing external document", () => {
    const result = resolveResolverDocument({
      version: "2025.10",
      resolutionOrder: [
        {
          name: "base",
          type: "set",
          sources: [{ $ref: "missing.json#/x" }],
        },
      ],
    });
    const errors = result.documentErrors.filter((e) => e.kind === "invalid-pointer");
    expect(errors).toHaveLength(1);
    expect(errors[0]?.target).toBe("missing.json#/x");
  });

  it("reports ref-cycle when two sets reference each other", () => {
    const result = resolveResolverDocument({
      version: "2025.10",
      sets: {
        a: { sources: [{ $ref: "#/sets/b" }] },
        b: { sources: [{ $ref: "#/sets/a" }] },
      },
      resolutionOrder: [{ $ref: "#/sets/a" }],
    });
    const errors = result.documentErrors.filter((e) => e.kind === "ref-cycle");
    expect(errors).toHaveLength(1);
  });

  it("resolves a same-document $ref to #/sets/<name> from inside a modifier context", () => {
    const result = resolveResolverDocument(
      {
        version: "2025.10",
        sets: {
          base: {
            sources: [{ color: { bg: color(0, 0, 0, "#000000") } }],
          },
        },
        modifiers: {
          theme: {
            default: "light",
            contexts: {
              light: [{ $ref: "#/sets/base" }],
              dark: [{ color: { bg: color(1, 1, 1, "#ffffff") } }],
            },
          },
        },
        resolutionOrder: [{ $ref: "#/modifiers/theme" }],
      },
      { theme: "light" },
    );
    expect(result.documentErrors).toEqual([]);
    expect(result.tokens.byPath.get("color.bg")?.$value).toMatchObject({ hex: "#000000" });
  });
});
