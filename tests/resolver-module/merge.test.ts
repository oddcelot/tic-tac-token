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

describe("resolver module merge semantics (§6.2, §4.1.4)", () => {
  it("merges a set's sources array with the last source winning", () => {
    const result = resolveResolverDocument({
      version: "2025.10",
      resolutionOrder: [
        {
          name: "base",
          type: "set",
          sources: [
            { color: { bg: color(0, 0, 0, "#000000") } },
            { color: { bg: color(1, 1, 1, "#ffffff") } },
          ],
        },
      ],
    });
    expect(result.documentErrors).toEqual([]);
    expect(result.tokens.byPath.get("color.bg")?.$value).toMatchObject({ hex: "#ffffff" });
  });

  it("merges a modifier's selected context array with the last source winning", () => {
    const result = resolveResolverDocument({
      version: "2025.10",
      resolutionOrder: [
        {
          name: "theme",
          type: "modifier",
          default: "light",
          contexts: {
            light: [
              { color: { bg: color(1, 1, 1, "#ffffff") } },
              { color: { bg: color(0.9, 0.9, 0.9, "#e5e5e5") } },
            ],
            dark: [{ color: { bg: color(0, 0, 0, "#000000") } }],
          },
        },
      ],
    });
    expect(result.documentErrors).toEqual([]);
    expect(result.tokens.byPath.get("color.bg")?.$value).toMatchObject({ hex: "#e5e5e5" });
  });

  it("lets later resolutionOrder entries override earlier ones", () => {
    const result = resolveResolverDocument({
      version: "2025.10",
      resolutionOrder: [
        {
          name: "base",
          type: "set",
          sources: [{ color: { bg: color(0, 0, 0, "#000000") } }],
        },
        {
          name: "override",
          type: "set",
          sources: [{ color: { bg: color(1, 1, 1, "#ffffff") } }],
        },
      ],
    });
    expect(result.documentErrors).toEqual([]);
    expect(result.tokens.byPath.get("color.bg")?.$value).toMatchObject({ hex: "#ffffff" });
  });

  it("deep-merges group-level keys while a locally redefined token replaces wholesale", () => {
    const result = resolveResolverDocument({
      version: "2025.10",
      resolutionOrder: [
        {
          name: "base",
          type: "set",
          sources: [
            {
              color: {
                bg: color(0, 0, 0, "#000000"),
                text: color(1, 1, 1, "#ffffff"),
              },
            },
          ],
        },
        {
          name: "override",
          type: "set",
          sources: [{ color: { bg: color(0.5, 0.5, 0.5, "#808080") } }],
        },
      ],
    });
    expect(result.documentErrors).toEqual([]);
    // Locally redefined token replaces wholesale.
    expect(result.tokens.byPath.get("color.bg")?.$value).toMatchObject({ hex: "#808080" });
    // Sibling key at the same group level survives the deep merge.
    expect(result.tokens.byPath.get("color.text")?.$value).toMatchObject({ hex: "#ffffff" });
  });

  it("merges inline set and inline modifier entries declared with name and type", () => {
    const result = resolveResolverDocument(
      {
        version: "2025.10",
        resolutionOrder: [
          {
            name: "base",
            type: "set",
            sources: [{ size: { md: dim(16) } }],
          },
          {
            name: "theme",
            type: "modifier",
            default: "light",
            contexts: {
              light: [{ color: { bg: color(1, 1, 1, "#ffffff") } }],
              dark: [{ color: { bg: color(0, 0, 0, "#000000") } }],
            },
          },
        ],
      },
      { theme: "light" },
    );
    expect(result.documentErrors).toEqual([]);
    expect(result.tokens.byPath.get("size.md")?.$value).toEqual({ value: 16, unit: "px" });
    expect(result.tokens.byPath.get("color.bg")?.$value).toMatchObject({ hex: "#ffffff" });
  });

  it("preserves a $extends declared inside a merged source", () => {
    const result = resolveResolverDocument({
      version: "2025.10",
      sets: {
        base: {
          sources: [
            { brand: { $type: "color", primary: color(1, 0, 0, "#ff0000") } },
            { themed: { $type: "color", $extends: "{brand}" } },
          ],
        },
      },
      resolutionOrder: [{ $ref: "#/sets/base" }],
    });
    expect(result.documentErrors).toEqual([]);
    expect(result.tokenErrors).toEqual([]);
    expect(result.tokens.byPath.get("themed.primary")?.$value).toMatchObject({
      hex: "#ff0000",
    });
  });
});
