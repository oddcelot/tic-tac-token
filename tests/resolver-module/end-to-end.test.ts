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

// A realistic document: a base set plus a theme modifier with light/dark
// contexts, combined via resolutionOrder.
const document = {
  version: "2025.10",
  sets: {
    base: {
      sources: [{ size: { md: dim(16) } }],
    },
  },
  modifiers: {
    theme: {
      default: "light",
      contexts: {
        light: [{ color: { bg: color(1, 1, 1, "#ffffff") } }],
        dark: [{ color: { bg: color(0, 0, 0, "#000000") } }],
      },
    },
  },
  resolutionOrder: [{ $ref: "#/sets/base" }, { $ref: "#/modifiers/theme" }],
};

describe("resolveResolverDocument end-to-end", () => {
  it("resolves the light context by input", () => {
    const result = resolveResolverDocument(document, { theme: "light" });
    expect(result.documentErrors).toEqual([]);
    expect(result.tokenErrors).toEqual([]);
    expect(result.tokens.byPath.get("size.md")?.$value).toEqual({ value: 16, unit: "px" });
    expect(result.tokens.byPath.get("color.bg")?.$value).toMatchObject({ hex: "#ffffff" });
  });

  it("resolves the dark context by input", () => {
    const result = resolveResolverDocument(document, { theme: "dark" });
    expect(result.documentErrors).toEqual([]);
    expect(result.tokenErrors).toEqual([]);
    expect(result.tokens.byPath.get("size.md")?.$value).toEqual({ value: 16, unit: "px" });
    expect(result.tokens.byPath.get("color.bg")?.$value).toMatchObject({ hex: "#000000" });
  });

  it("keeps a group's $root token addressable at <group>.$root through the merge", () => {
    const result = resolveResolverDocument({
      version: "2025.10",
      resolutionOrder: [
        {
          name: "base",
          type: "set",
          sources: [
            {
              color: {
                accent: {
                  $root: color(1, 0, 0, "#ff0000"),
                  hover: color(0, 1, 0, "#00ff00"),
                },
              },
            },
          ],
        },
      ],
    });
    expect(result.documentErrors).toEqual([]);
    expect(result.tokens.byPath.get("color.accent.$root")?.$value).toMatchObject({
      hex: "#ff0000",
    });
    expect(result.tokens.byPath.get("color.accent.hover")?.$value).toMatchObject({
      hex: "#00ff00",
    });
  });

  it("reports a type-mismatch token error for a color alias targeting a dimension", () => {
    const result = resolveResolverDocument({
      version: "2025.10",
      resolutionOrder: [
        {
          name: "base",
          type: "set",
          sources: [
            {
              color: { link: { $type: "color", $value: "{size}" } },
              size: dim(16),
            },
          ],
        },
      ],
    });
    expect(result.documentErrors).toEqual([]);
    expect(result.tokenErrors.some((e) => e.kind === "type-mismatch")).toBe(true);
  });
});
