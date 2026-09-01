// Factoring a value matrix into a cascade.
//
// Resolving a document at every permutation gives a full matrix: for each
// custom property, its value at each point. Writing that out directly is the
// combinatorial explosion the Resolver Module exists to avoid, just relocated
// into the stylesheet. Factoring emits the base once, then only what *changes*
// — one block per single-axis deviation, and a compound block for a property
// whose value genuinely depends on a *combination* of modifiers.
//
// Pure and CSS-free: no selectors, no text. Everything here is testable by
// handing in a matrix built by hand.
export type AxisCoordinate = { axis: string; context: string };

/** The shape of a modifier axis this module needs. `ModifierAxis` satisfies it. */
export type FactorAxis = {
  name: string;
  contexts: readonly string[];
  /** The context this axis sits at in the base permutation. */
  base: string;
};

/** The shape of a permutation this module needs. `Permutation` satisfies it. */
export type FactorPoint = {
  id: string;
  inputs: Readonly<Record<string, string>>;
  deviations: readonly AxisCoordinate[];
};

/**
 * Property name → permutation id → serialised value.
 *
 * Values are compared as *CSS strings*, not as token `$value`s: two contexts
 * whose JSON differs but whose CSS agrees must not produce a redundant
 * override. A property absent at a point (untranslatable there) is simply not
 * in the inner map.
 */
export type ValueMatrix = Map<string, Map<string, string>>;

export type FactoredBlock = {
  /** The coordinates that must all hold for this block to apply. */
  conditions: readonly AxisCoordinate[];
  /** Property → value. Never empty; empty blocks are dropped. */
  values: Map<string, string>;
};

export type FactorResult = {
  /** Properties and values at the base permutation. */
  base: Map<string, string>;
  /**
   * Override blocks in cascade order: every single-axis block first, then
   * compound blocks by ascending deviation count.
   */
  blocks: FactoredBlock[];
  /**
   * Properties that have a value at the base but none at some permutation.
   * Nothing is emitted for these — the base value stays in effect — but the
   * caller should report them rather than let a property silently go stale.
   */
  untranslatable: { property: string; permutationId: string }[];
};

/**
 * Factor a value matrix into a base block plus the minimum overrides needed to
 * reproduce it.
 *
 * The result is **correct by construction**: replaying the cascade over any
 * permutation in `points` yields exactly the matrix. It is deliberately *not*
 * minimal — finding the smallest block set is Boolean-function minimisation,
 * and the extra blocks it would save cost less than the unreadability. What is
 * guaranteed is that no compound block appears unless some property's value
 * genuinely depends on the combination.
 *
 * This relies on compound selectors outranking their own sub-selectors, which
 * an attribute-per-axis scheme gives for free: an n-axis block has specificity
 * (0, n, 0), so source order and specificity agree and the greedy pass below
 * needs no further ordering care.
 */
export function factorMatrix(
  matrix: ValueMatrix,
  axes: readonly FactorAxis[],
  points: readonly FactorPoint[],
): FactorResult {
  const byId = new Map(points.map((p) => [p.id, p]));
  const basePoint = points.find((p) => p.deviations.length === 0);
  const properties = [...matrix.keys()];

  const base = new Map<string, string>();
  if (basePoint) {
    for (const property of properties) {
      const value = matrix.get(property)?.get(basePoint.id);
      if (value !== undefined) base.set(property, value);
    }
  }

  const blocks: FactoredBlock[] = [];
  const untranslatable: FactorResult["untranslatable"] = [];

  if (!basePoint) return { base, blocks, untranslatable };

  const valueAt = (property: string, id: string): string | undefined =>
    matrix.get(property)?.get(id);

  const noteMissing = (property: string, id: string): void => {
    if (base.has(property)) untranslatable.push({ property, permutationId: id });
  };

  // ── Single-axis deltas, in axis order. Every property whose value at this
  // one deviation differs from the base.
  for (const axis of axes) {
    for (const context of axis.contexts) {
      if (context === axis.base) continue;
      const point = byId.get(pointId(points, axes, { ...basePoint.inputs, [axis.name]: context }));
      if (!point) continue; // truncated enumeration, or a pinned axis

      const values = new Map<string, string>();
      for (const property of properties) {
        const value = valueAt(property, point.id);
        if (value === undefined) {
          noteMissing(property, point.id);
          continue;
        }
        if (value !== base.get(property)) values.set(property, value);
      }
      if (values.size > 0) blocks.push({ conditions: [{ axis: axis.name, context }], values });
    }
  }

  // ── Residuals: whatever the cascade so far still gets wrong. Ascending
  // deviation count, so a 3-axis block is checked against the 2-axis blocks
  // that already refine it.
  const compound = points
    .filter((p) => p.deviations.length >= 2)
    .sort((a, b) => a.deviations.length - b.deviations.length);

  for (const point of compound) {
    const values = new Map<string, string>();
    for (const property of properties) {
      const actual = valueAt(property, point.id);
      if (actual === undefined) {
        noteMissing(property, point.id);
        continue;
      }
      if (actual !== predict(base, blocks, point, property)) values.set(property, actual);
    }
    if (values.size > 0) blocks.push({ conditions: point.deviations, values });
  }

  return { base, blocks, untranslatable };
}

/** The value the cascade produces for `property` at `point`, given the blocks so far. */
export function predict(
  base: ReadonlyMap<string, string>,
  blocks: readonly FactoredBlock[],
  point: FactorPoint,
  property: string,
): string | undefined {
  let value = base.get(property);
  for (const block of blocks) {
    if (!applies(block, point)) continue;
    const override = block.values.get(property);
    if (override !== undefined) value = override;
  }
  return value;
}

/** A block applies at a point when every one of its coordinates holds there. */
export function applies(block: FactoredBlock, point: FactorPoint): boolean {
  return block.conditions.every(({ axis, context }) => point.inputs[axis] === context);
}

/**
 * Find the id of the point matching an input map. Permutation ids are total —
 * every axis appears — so this is a lookup by reconstructed key rather than a
 * scan, with a scan as the fallback for callers whose ids are formatted
 * differently.
 */
function pointId(
  points: readonly FactorPoint[],
  axes: readonly FactorAxis[],
  inputs: Record<string, string>,
): string {
  const key = axes.map((a) => `${a.name}=${inputs[a.name]}`).join("&");
  if (points.some((p) => p.id === key)) return key;
  const found = points.find((p) => axes.every((a) => p.inputs[a.name] === inputs[a.name]));
  return found?.id ?? key;
}
