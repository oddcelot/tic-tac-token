import { describe, expect, it } from "vitest";
import {
  buildResolutionOrder,
  resolveFromOrder,
  resolveResolverDocument,
  resolverModifiers,
} from "../../src/resolver-module/index.ts";

const color = (r: number, g: number, b: number, hex: string) => ({
  $type: "color" as const,
  $value: { colorSpace: "srgb", components: [r, g, b], alpha: 1, hex },
});

const themeDoc = {
  version: "2025.10",
  sets: { base: { sources: [{ color: { bg: color(0.5, 0.5, 0.5, "#808080") } }] } },
  modifiers: {
    theme: {
      default: "light",
      description: "Brand palette.",
      $extensions: { "tic-tac-token.css": { colorScheme: true } },
      contexts: {
        light: [{ color: { bg: color(1, 1, 1, "#ffffff") } }],
        dark: [{ color: { bg: color(0, 0, 0, "#000000") } }],
      },
    },
    density: {
      contexts: {
        cozy: [{ size: { gap: { $type: "dimension", $value: { value: 16, unit: "px" } } } }],
        compact: [{ size: { gap: { $type: "dimension", $value: { value: 8, unit: "px" } } } }],
      },
    },
  },
  resolutionOrder: [
    { $ref: "#/sets/base" },
    { $ref: "#/modifiers/theme" },
    { $ref: "#/modifiers/density" },
  ],
};

describe("resolverModifiers", () => {
  it("lists modifiers in resolutionOrder order, not declaration order", () => {
    const doc = {
      ...themeDoc,
      resolutionOrder: [
        { $ref: "#/sets/base" },
        { $ref: "#/modifiers/density" },
        { $ref: "#/modifiers/theme" },
      ],
    };
    expect(resolverModifiers(doc).map((m) => m.name)).toEqual(["density", "theme"]);
  });

  it("reports contexts in declaration order, plus default and metadata", () => {
    const [theme, density] = resolverModifiers(themeDoc);
    expect(theme).toEqual({
      name: "theme",
      contexts: ["light", "dark"],
      default: "light",
      description: "Brand palette.",
      $extensions: { "tic-tac-token.css": { colorScheme: true } },
    });
    expect(density?.default).toBeUndefined();
    expect(density?.contexts).toEqual(["cozy", "compact"]);
  });

  it("honours a sibling `name` that renames a $ref entry", () => {
    const doc = {
      ...themeDoc,
      resolutionOrder: [{ $ref: "#/sets/base" }, { $ref: "#/modifiers/theme", name: "appearance" }],
    };
    expect(resolverModifiers(doc).map((m) => m.name)).toEqual(["appearance"]);
  });

  it("picks up inline modifier entries", () => {
    const doc = {
      version: "2025.10",
      resolutionOrder: [
        {
          name: "contrast",
          type: "modifier",
          default: "normal",
          contexts: {
            normal: [{ color: { bg: color(1, 1, 1, "#ffffff") } }],
            high: [{ color: { bg: color(0, 0, 0, "#000000") } }],
          },
        },
      ],
    };
    expect(resolverModifiers(doc)).toEqual([
      { name: "contrast", contexts: ["normal", "high"], default: "normal", description: undefined, $extensions: undefined },
    ]);
  });

  it("excludes a declared modifier that resolutionOrder never references", () => {
    // Passing such a name as an input raises `unknown-input-key`, so it must
    // not appear in a list a caller will build inputs from.
    const doc = { ...themeDoc, resolutionOrder: [{ $ref: "#/sets/base" }, { $ref: "#/modifiers/theme" }] };
    expect(resolverModifiers(doc).map((m) => m.name)).toEqual(["theme"]);

    const result = resolveResolverDocument(doc, { density: "compact" });
    expect(result.documentErrors.map((e) => e.kind)).toContain("unknown-input-key");
  });

  it("returns [] for a document the schema rejects, without throwing", () => {
    expect(resolverModifiers({ version: "2024.1", resolutionOrder: [] })).toEqual([]);
    expect(resolverModifiers(null)).toEqual([]);
    expect(resolverModifiers({})).toEqual([]);
  });
});

describe("buildResolutionOrder / resolveFromOrder", () => {
  it("resolves identically to resolveResolverDocument", () => {
    const order = buildResolutionOrder(themeDoc);
    const inputs = { theme: "dark", density: "compact" };
    expect(resolveFromOrder(order, inputs).mergedTree).toEqual(
      resolveResolverDocument(themeDoc, inputs).mergedTree,
    );
  });

  it("does not leak one combination's input errors into the next", () => {
    // `density` has no default, so resolving with no inputs reports
    // missing-required-input. Reusing the same order must not carry that
    // error into a later call that supplies the input.
    const order = buildResolutionOrder(themeDoc);

    const bare = resolveFromOrder(order, {});
    expect(bare.documentErrors.map((e) => e.kind)).toContain("missing-required-input");

    const supplied = resolveFromOrder(order, { density: "compact" });
    expect(supplied.documentErrors.map((e) => e.kind)).not.toContain("missing-required-input");

    const again = resolveFromOrder(order, {});
    expect(again.documentErrors.filter((e) => e.kind === "missing-required-input")).toHaveLength(1);
  });

  it("carries the input-independent diagnostics into every resolution", () => {
    const order = buildResolutionOrder(themeDoc);
    // `density` declares two contexts and no default — no structural error —
    // so a clean document stays clean across repeated resolutions.
    expect(resolveFromOrder(order, { density: "cozy" }).documentErrors).toEqual([]);
    expect(resolveFromOrder(order, { density: "compact" }).documentErrors).toEqual([]);
  });

  it("reports schema failures once per issue and yields an empty result", () => {
    const order = buildResolutionOrder({ version: "2024.1", resolutionOrder: [] });
    expect(order.doc).toBeUndefined();
    expect(order.entries).toEqual([]);
    expect(order.errors.every((e) => e.kind === "invalid-document")).toBe(true);

    const result = resolveFromOrder(order, {});
    expect(result.mergedTree).toEqual({});
    expect(result.tokens.tokens).toEqual([]);
    expect(result.documentErrors).toEqual(order.errors);
  });
});
