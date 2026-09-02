import { describe, expect, it } from "vitest";
import { resolveResolverDocument } from "../../src/resolver-module/index.ts";
import {
  DEFAULT_MAX_PERMUTATIONS,
  enumeratePermutations,
  modifierAxes,
  resolvePermutations,
} from "../../src/resolver-module/permutations.ts";

const color = (hex: string) => ({
  $type: "color" as const,
  $value: { colorSpace: "srgb", components: [0, 0, 0], alpha: 1, hex },
});
const dim = (value: number) => ({
  $type: "dimension" as const,
  $value: { value, unit: "px" as const },
});

/** theme(2, default light) × density(2, no default) × contrast(3, default normal) = 12 */
const doc = {
  version: "2025.10",
  sets: { base: { sources: [{ size: { md: dim(16) } }] } },
  modifiers: {
    theme: {
      default: "light",
      contexts: {
        light: [{ color: { bg: color("#ffffff") } }],
        dark: [{ color: { bg: color("#000000") } }],
      },
    },
    density: {
      contexts: { cozy: [{ size: { gap: dim(16) } }], compact: [{ size: { gap: dim(8) } }] },
    },
    contrast: {
      default: "normal",
      contexts: {
        normal: [{ color: { fg: color("#333333") } }],
        high: [{ color: { fg: color("#000000") } }],
        max: [{ color: { fg: color("#000000") } }],
      },
    },
  },
  resolutionOrder: [
    { $ref: "#/sets/base" },
    { $ref: "#/modifiers/theme" },
    { $ref: "#/modifiers/density" },
    { $ref: "#/modifiers/contrast" },
  ],
};

describe("modifierAxes", () => {
  it("orders axes by resolutionOrder and keeps contexts in declaration order", () => {
    const { axes } = modifierAxes(doc);
    expect(axes.map((a) => a.name)).toEqual(["theme", "density", "contrast"]);
    expect(axes[0]?.contexts).toEqual(["light", "dark"]);
    expect(axes[2]?.contexts).toEqual(["normal", "high", "max"]);
  });

  it("uses the declared default as the base coordinate", () => {
    const { axes, errors } = modifierAxes(doc);
    expect(axes[0]).toMatchObject({ name: "theme", default: "light", base: "light" });
    expect(errors.filter((e) => e.at === "resolutionOrder[1]")).toEqual([]);
  });

  it("falls back to the first context and reports no-default-context", () => {
    const { axes, errors } = modifierAxes(doc);
    expect(axes[1]).toMatchObject({ name: "density", default: undefined, base: "cozy" });
    const err = errors.find((e) => e.kind === "no-default-context");
    expect(err?.at).toBe("resolutionOrder[2]");
    expect(err?.message).toContain("cozy");
  });

  it("reports no-default-context when the declared default names no context", () => {
    const bad = {
      version: "2025.10",
      resolutionOrder: [
        {
          name: "theme",
          type: "modifier",
          default: "sepia",
          contexts: { light: [{ color: { bg: color("#ffffff") } }], dark: [{ color: { bg: color("#000000") } }] },
        },
      ],
    };
    const { axes, errors } = modifierAxes(bad);
    expect(axes[0]?.base).toBe("light");
    expect(errors.find((e) => e.kind === "no-default-context")?.message).toContain("sepia");
  });

  it("skips a modifier with no contexts and never throws on a bad document", () => {
    const empty = {
      version: "2025.10",
      resolutionOrder: [{ name: "theme", type: "modifier", contexts: {} }],
    };
    expect(modifierAxes(empty).axes).toEqual([]);
    expect(modifierAxes({ version: "2024.1", resolutionOrder: [] }).axes).toEqual([]);
    expect(modifierAxes(null).axes).toEqual([]);
  });
});

describe("enumeratePermutations", () => {
  it("takes the full cartesian product with the base first", () => {
    const { axes } = modifierAxes(doc);
    const { permutations, base, total, truncated } = enumeratePermutations(axes);

    expect(total).toBe(12);
    expect(truncated).toBe(false);
    expect(permutations).toHaveLength(12);
    expect(permutations[0]).toBe(base);
    expect(base.id).toBe("theme=light&density=cozy&contrast=normal");
    expect(base.isBase).toBe(true);
    expect(base.deviations).toEqual([]);
    expect(new Set(permutations.map((p) => p.id)).size).toBe(12);
  });

  it("sorts by ascending deviation count so a refining block never precedes a broader one", () => {
    const { axes } = modifierAxes(doc);
    const counts = enumeratePermutations(axes).permutations.map((p) => p.deviations.length);
    expect(counts).toEqual([...counts].sort((a, b) => a - b));
    // 1 base, 4 single-axis (1 + 1 + 2), 5 two-axis, 2 three-axis.
    expect(counts.filter((c) => c === 0)).toHaveLength(1);
    expect(counts.filter((c) => c === 1)).toHaveLength(4);
  });

  it("records deviations relative to each axis's base, in axis order", () => {
    const { axes } = modifierAxes(doc);
    const { permutations } = enumeratePermutations(axes);
    const p = permutations.find((x) => x.id === "theme=dark&density=compact&contrast=normal");
    expect(p?.deviations).toEqual([
      { axis: "theme", context: "dark" },
      { axis: "density", context: "compact" },
    ]);
    expect(p?.inputs).toEqual({ theme: "dark", density: "compact", contrast: "normal" });
  });

  it("degrades to base plus single-axis variations past maxPermutations", () => {
    const { axes } = modifierAxes(doc);
    const { permutations, total, truncated, errors } = enumeratePermutations(axes, {
      maxPermutations: 6,
    });

    expect(total).toBe(12);
    expect(truncated).toBe(true);
    // base + (2-1) + (2-1) + (3-1)
    expect(permutations).toHaveLength(5);
    expect(permutations.slice(1).every((p) => p.deviations.length === 1)).toBe(true);

    const limit = errors.find((e) => e.kind === "permutation-limit");
    expect(limit?.message).toContain("12 permutations");
    expect(limit?.message).toContain("maxPermutations=6");
    expect(limit?.message).toContain("Interactions between modifiers were not checked");
  });

  it("defaults maxPermutations to 512", () => {
    const wide = Array.from({ length: 10 }, (_, i) => ({
      name: `m${i}`,
      contexts: ["a", "b", "c"] as const,
      default: "a",
      base: "a",
    }));
    // 3^10 = 59049
    const { truncated, total } = enumeratePermutations(wide);
    expect(total).toBeGreaterThan(DEFAULT_MAX_PERMUTATIONS);
    expect(truncated).toBe(true);
  });

  describe("the axes option", () => {
    it("narrows an axis to a subset, always keeping the base reachable", () => {
      const { axes } = modifierAxes(doc);
      const { permutations, total } = enumeratePermutations(axes, {
        axes: { contrast: ["high"] },
      });
      // theme 2 × density 2 × contrast {normal, high} = 8
      expect(total).toBe(8);
      expect(new Set(permutations.map((p) => p.inputs["contrast"]))).toEqual(
        new Set(["normal", "high"]),
      );
    });

    it("pins an axis to its base when given an empty list", () => {
      const { axes } = modifierAxes(doc);
      const { permutations, total } = enumeratePermutations(axes, { axes: { contrast: [] } });
      expect(total).toBe(4);
      expect(permutations.every((p) => p.inputs["contrast"] === "normal")).toBe(true);
    });

    it("matches axis and context names case-insensitively", () => {
      const { axes } = modifierAxes(doc);
      const { total, errors } = enumeratePermutations(axes, { axes: { CONTRAST: ["HIGH"] } });
      expect(total).toBe(8);
      expect(errors).toEqual([]);
    });

    it("reports unknown-axis and unknown-context without dropping the rest", () => {
      const { axes } = modifierAxes(doc);
      const { total, errors } = enumeratePermutations(axes, {
        axes: { nope: ["x"], contrast: ["high", "ultra"] },
      });
      expect(errors.map((e) => e.kind).sort()).toEqual(["unknown-axis", "unknown-context"]);
      expect(errors.find((e) => e.kind === "unknown-context")?.message).toContain("ultra");
      // `high` still applied despite `ultra` being rejected.
      expect(total).toBe(8);
    });
  });

  it("yields a single base permutation for a document with no modifiers", () => {
    const flat = {
      version: "2025.10",
      resolutionOrder: [{ name: "base", type: "set", sources: [{ size: { md: dim(16) } }] }],
    };
    const { axes } = modifierAxes(flat);
    const { permutations, total, base } = enumeratePermutations(axes);
    expect(total).toBe(1);
    expect(permutations).toEqual([base]);
    expect(base.id).toBe("");
    expect(base.isBase).toBe(true);
  });
});

describe("resolvePermutations", () => {
  it("resolves every point identically to a hand-run resolveResolverDocument", () => {
    const { byId, all, total } = resolvePermutations(doc);
    expect(all).toHaveLength(total);

    for (const id of [
      "theme=dark&density=compact&contrast=high",
      "theme=light&density=cozy&contrast=normal",
    ]) {
      const entry = byId.get(id)!;
      const direct = resolveResolverDocument(doc, { ...entry.permutation.inputs });
      expect(entry.resolved.mergedTree).toEqual(direct.mergedTree);
      expect(entry.resolved.tokens.byPath.get("color.bg")?.$value).toEqual(
        direct.tokens.byPath.get("color.bg")?.$value,
      );
    }
  });

  it("exposes the base permutation and resolves it at every axis default", () => {
    const { base } = resolvePermutations(doc);
    expect(base.permutation.isBase).toBe(true);
    expect(base.resolved.tokens.byPath.get("color.bg")?.$value).toMatchObject({ hex: "#ffffff" });
    expect(base.resolved.tokens.byPath.get("size.gap")?.$value).toMatchObject({ value: 16 });
  });

  it("actually varies output across axes", () => {
    const { byId } = resolvePermutations(doc);
    const hex = (id: string) =>
      (byId.get(id)!.resolved.tokens.byPath.get("color.bg")?.$value as { hex: string }).hex;
    expect(hex("theme=light&density=cozy&contrast=normal")).toBe("#ffffff");
    expect(hex("theme=dark&density=cozy&contrast=normal")).toBe("#000000");
  });

  it("reports document diagnostics once, not once per permutation", () => {
    const { documentErrors, errors, all } = resolvePermutations(doc);
    expect(all.length).toBeGreaterThan(1);
    expect(documentErrors).toEqual([]);
    // `density` has no default — reported once as an axis-level diagnostic.
    expect(errors.filter((e) => e.kind === "no-default-context")).toHaveLength(1);
  });

  it("supplies every axis an input, so no permutation reports missing-required-input", () => {
    // `density` declares no default; enumeration pins it to a real context,
    // which is what keeps the per-point resolutions clean.
    const { all } = resolvePermutations(doc);
    for (const { resolved } of all) {
      expect(resolved.documentErrors.map((e) => e.kind)).not.toContain("missing-required-input");
    }
  });

  it("threads externalDocuments through to every permutation", () => {
    const external = {
      version: "2025.10",
      sets: { base: { sources: [{ $ref: "tokens/base.json#" }] } },
      modifiers: {
        theme: {
          default: "light",
          contexts: {
            light: [{ $ref: "tokens/light.json#" }],
            dark: [{ $ref: "tokens/dark.json#" }],
          },
        },
      },
      resolutionOrder: [{ $ref: "#/sets/base" }, { $ref: "#/modifiers/theme" }],
    };
    const { byId, all } = resolvePermutations(external, {
      externalDocuments: {
        "tokens/base.json": { size: { md: dim(16) } },
        "tokens/light.json": { color: { bg: color("#ffffff") } },
        "tokens/dark.json": { color: { bg: color("#000000") } },
      },
    });

    expect(all.every((e) => e.resolved.documentErrors.length === 0)).toBe(true);
    expect(byId.get("theme=dark")?.resolved.tokens.byPath.get("color.bg")?.$value).toMatchObject({
      hex: "#000000",
    });
  });

  it("surfaces a schema failure once, without resolving a product of broken points", () => {
    const { axes, all, total, documentErrors } = resolvePermutations({
      version: "2024.1",
      resolutionOrder: [],
    });
    expect(axes).toEqual([]);
    expect(total).toBe(1);
    expect(all).toHaveLength(1);
    expect(documentErrors.length).toBeGreaterThan(0);
    expect(documentErrors.every((e) => e.kind === "invalid-document")).toBe(true);
  });
});
