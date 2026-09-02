import { describe, expect, it } from "vitest";
import {
  applies,
  factorMatrix,
  predict,
  type FactorAxis,
  type FactorPoint,
  type ValueMatrix,
} from "../../src/css/factor.ts";

/** Build the total cartesian product of the axes, mirroring `enumeratePermutations`. */
function points(axes: readonly FactorAxis[]): FactorPoint[] {
  let rows: Record<string, string>[] = [{}];
  for (const axis of axes) {
    rows = rows.flatMap((row) => axis.contexts.map((c) => ({ ...row, [axis.name]: c })));
  }
  return rows
    .map((inputs) => ({
      id: axes.map((a) => `${a.name}=${inputs[a.name]}`).join("&"),
      inputs,
      deviations: axes
        .filter((a) => inputs[a.name] !== a.base)
        .map((a) => ({ axis: a.name, context: inputs[a.name]! })),
    }))
    .sort((a, b) => a.deviations.length - b.deviations.length);
}

/** Turn `{ prop: { permId: value } }` into a ValueMatrix. */
function matrix(source: Record<string, Record<string, string>>): ValueMatrix {
  return new Map(Object.entries(source).map(([k, v]) => [k, new Map(Object.entries(v))]));
}

/** Fill a property from a function of the point's inputs. */
function derive(pts: readonly FactorPoint[], f: (i: Record<string, string>) => string) {
  return Object.fromEntries(pts.map((p) => [p.id, f(p.inputs)]));
}

const theme: FactorAxis = { name: "theme", contexts: ["light", "dark"], base: "light" };
const density: FactorAxis = { name: "density", contexts: ["cozy", "compact"], base: "cozy" };
const contrast: FactorAxis = { name: "contrast", contexts: ["normal", "high"], base: "normal" };

describe("factorMatrix", () => {
  it("emits the base and nothing else when nothing varies", () => {
    const axes = [theme, density];
    const pts = points(axes);
    const m = matrix({ "--color-bg": derive(pts, () => "#fff") });

    const { base, blocks } = factorMatrix(m, axes, pts);
    expect(base).toEqual(new Map([["--color-bg", "#fff"]]));
    expect(blocks).toEqual([]);
  });

  it("emits one single-axis block per deviating context", () => {
    const axes = [theme];
    const pts = points(axes);
    const m = matrix({
      "--color-bg": derive(pts, (i) => (i["theme"] === "dark" ? "#000" : "#fff")),
    });

    const { base, blocks } = factorMatrix(m, axes, pts);
    expect(base.get("--color-bg")).toBe("#fff");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.conditions).toEqual([{ axis: "theme", context: "dark" }]);
    expect(blocks[0]?.values).toEqual(new Map([["--color-bg", "#000"]]));
  });

  it("omits a property whose deviating value equals the base", () => {
    const axes = [theme];
    const pts = points(axes);
    const m = matrix({
      "--color-bg": derive(pts, (i) => (i["theme"] === "dark" ? "#000" : "#fff")),
      "--space-md": derive(pts, () => "16px"),
    });

    const { blocks } = factorMatrix(m, axes, pts);
    expect([...(blocks[0]?.values.keys() ?? [])]).toEqual(["--color-bg"]);
  });

  it("emits no compound block when the axes are orthogonal", () => {
    const axes = [theme, density];
    const pts = points(axes);
    const m = matrix({
      "--color-bg": derive(pts, (i) => (i["theme"] === "dark" ? "#000" : "#fff")),
      "--space-gap": derive(pts, (i) => (i["density"] === "compact" ? "8px" : "16px")),
    });

    const { blocks } = factorMatrix(m, axes, pts);
    expect(blocks).toHaveLength(2);
    expect(blocks.every((b) => b.conditions.length === 1)).toBe(true);
  });

  it("emits exactly one compound block holding only the interacting property", () => {
    const axes = [theme, density];
    const pts = points(axes);
    const m = matrix({
      // Orthogonal.
      "--color-bg": derive(pts, (i) => (i["theme"] === "dark" ? "#000" : "#fff")),
      // Genuinely combination-dependent: compact is tighter, but only in dark.
      "--space-gap": derive(pts, (i) =>
        i["theme"] === "dark" && i["density"] === "compact" ? "4px" : i["density"] === "compact" ? "8px" : "16px",
      ),
    });

    const { blocks } = factorMatrix(m, axes, pts);
    const compound = blocks.filter((b) => b.conditions.length === 2);
    expect(compound).toHaveLength(1);
    expect(compound[0]?.values).toEqual(new Map([["--space-gap", "4px"]]));
    expect(compound[0]?.conditions).toEqual([
      { axis: "theme", context: "dark" },
      { axis: "density", context: "compact" },
    ]);
  });

  it("catches a three-axis interaction that no two-axis block implies", () => {
    const axes = [theme, density, contrast];
    const pts = points(axes);
    const m = matrix({
      "--x": derive(pts, (i) =>
        i["theme"] === "dark" && i["density"] === "compact" && i["contrast"] === "high"
          ? "special"
          : "plain",
      ),
    });

    const { blocks } = factorMatrix(m, axes, pts);
    expect(blocks.filter((b) => b.conditions.length === 1)).toHaveLength(0);
    expect(blocks.filter((b) => b.conditions.length === 2)).toHaveLength(0);
    const triple = blocks.filter((b) => b.conditions.length === 3);
    expect(triple).toHaveLength(1);
    expect(triple[0]?.values).toEqual(new Map([["--x", "special"]]));
  });

  it("orders blocks by ascending deviation count", () => {
    const axes = [theme, density, contrast];
    const pts = points(axes);
    const m = matrix({
      "--x": derive(pts, (i) => `${i["theme"]}-${i["density"]}-${i["contrast"]}`),
    });

    const counts = factorMatrix(m, axes, pts).blocks.map((b) => b.conditions.length);
    expect(counts).toEqual([...counts].sort((a, b) => a - b));
  });

  it("treats a property that only appears in a deviating context as a delta", () => {
    const axes = [theme];
    const pts = points(axes);
    const dark = pts.find((p) => p.inputs["theme"] === "dark")!;
    const m = matrix({ "--only-dark": { [dark.id]: "1px" } });

    const { base, blocks, untranslatable } = factorMatrix(m, axes, pts);
    expect(base.has("--only-dark")).toBe(false);
    expect(blocks[0]?.values).toEqual(new Map([["--only-dark", "1px"]]));
    // Absent at base is not "untranslatable" — there was nothing to go stale.
    expect(untranslatable).toEqual([]);
  });

  it("reports a property that has a base value but none in some context", () => {
    const axes = [theme];
    const pts = points(axes);
    const base = pts.find((p) => p.deviations.length === 0)!;
    const dark = pts.find((p) => p.inputs["theme"] === "dark")!;
    const m = matrix({ "--x": { [base.id]: "solid" } });

    const { blocks, untranslatable } = factorMatrix(m, axes, pts);
    expect(blocks).toEqual([]);
    expect(untranslatable).toEqual([{ property: "--x", permutationId: dark.id }]);
  });

  it("still produces single-axis blocks from a truncated point set", () => {
    const axes = [theme, density];
    const all = points(axes);
    // Base plus single-axis variations only, as truncated enumeration yields.
    const pts = all.filter((p) => p.deviations.length <= 1);
    const m = matrix({
      "--color-bg": derive(all, (i) => (i["theme"] === "dark" ? "#000" : "#fff")),
      "--space-gap": derive(all, (i) => (i["density"] === "compact" ? "8px" : "16px")),
    });

    const { blocks } = factorMatrix(m, axes, pts);
    expect(blocks).toHaveLength(2);
    expect(blocks.every((b) => b.conditions.length === 1)).toBe(true);
  });

  it("returns an empty result when the point set has no base", () => {
    const axes = [theme];
    const pts = points(axes).filter((p) => p.deviations.length > 0);
    const m = matrix({ "--x": { [pts[0]!.id]: "1px" } });
    expect(factorMatrix(m, axes, pts)).toEqual({
      base: new Map(),
      blocks: [],
      untranslatable: [],
    });
  });
});

describe("cascade replay (the correctness property)", () => {
  // A deterministic pseudo-random matrix over three axes, mixing properties
  // that are constant, single-axis, two-axis and three-axis dependent. If
  // factoring drops or mis-scopes anything, replay diverges from the matrix.
  const axes = [
    { name: "theme", contexts: ["light", "dark", "sepia"], base: "light" },
    { name: "density", contexts: ["cozy", "compact"], base: "cozy" },
    { name: "contrast", contexts: ["normal", "high"], base: "normal" },
  ] satisfies FactorAxis[];

  // Deterministic hash, so the "random" matrix is stable across runs.
  const hash = (s: string): number => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };

  it("reproduces the matrix exactly at every permutation", () => {
    const pts = points(axes);
    const source: Record<string, Record<string, string>> = {};

    for (let i = 0; i < 40; i += 1) {
      const property = `--p${i}`;
      // Which axes this property actually depends on.
      const deps = axes.filter((a, j) => (hash(`${property}:${a.name}:${j}`) & 3) !== 0);
      source[property] = Object.fromEntries(
        pts.map((p) => [p.id, `v${hash(property + deps.map((a) => p.inputs[a.name]).join("|")) % 7}`]),
      );
    }

    const m = matrix(source);
    const { base, blocks } = factorMatrix(m, axes, pts);

    for (const point of pts) {
      for (const property of Object.keys(source)) {
        expect(predict(base, blocks, point, property), `${property} @ ${point.id}`).toBe(
          source[property]![point.id],
        );
      }
    }
  });

  it("does not emit a compound block for a purely single-axis matrix", () => {
    const pts = points(axes);
    const m = matrix({
      "--a": derive(pts, (i) => i["theme"]!),
      "--b": derive(pts, (i) => i["density"]!),
      "--c": derive(pts, (i) => i["contrast"]!),
    });
    expect(factorMatrix(m, axes, pts).blocks.every((b) => b.conditions.length === 1)).toBe(true);
  });
});

describe("applies", () => {
  it("is true only when every coordinate holds", () => {
    const point: FactorPoint = {
      id: "theme=dark&density=cozy",
      inputs: { theme: "dark", density: "cozy" },
      deviations: [{ axis: "theme", context: "dark" }],
    };
    expect(applies({ conditions: [{ axis: "theme", context: "dark" }], values: new Map() }, point)).toBe(true);
    expect(
      applies(
        {
          conditions: [
            { axis: "theme", context: "dark" },
            { axis: "density", context: "compact" },
          ],
          values: new Map(),
        },
        point,
      ),
    ).toBe(false);
    // A block with no conditions applies everywhere.
    expect(applies({ conditions: [], values: new Map() }, point)).toBe(true);
  });
});
