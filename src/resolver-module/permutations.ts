// Enumerating the contexts a resolver document can be resolved at.
//
// `resolveResolverDocument` is a point query: one `inputs` combination in, one
// resolved tokens document out. Consumers that switch contexts at runtime — a
// themed stylesheet, a Storybook toolbar — need every combination addressable
// at once. This module turns the document's modifiers into axes, takes their
// cartesian product, and resolves each point while validating the document
// only once.
import { buildResolutionOrder, resolveFromOrder } from "./index.ts";
import type { ResolutionOrder } from "./order.ts";
import type {
  ResolvedResolverDocument,
  ResolveResolverOptions,
  ResolverInputs,
  ResolverModuleError,
} from "./types.ts";

type Rec = Record<string, unknown>;

/** Default ceiling on the cartesian product before enumeration degrades. */
export const DEFAULT_MAX_PERMUTATIONS = 512;

export type PermutationErrorKind =
  /** Modifier declares no `default`; its first context was used as the base coordinate. */
  | "no-default-context"
  /** Cartesian product exceeds `maxPermutations`; only single-axis variations were enumerated. */
  | "permutation-limit"
  /** The `axes` option names a modifier that isn't in resolutionOrder. */
  | "unknown-axis"
  /** The `axes` option names a context the modifier doesn't declare. */
  | "unknown-context";

export type PermutationError = {
  kind: PermutationErrorKind;
  /** Document or option location, e.g. `modifiers.theme` or `axes.theme`. */
  at: string;
  message: string;
};

/** One modifier, viewed as a dimension the document can vary along. */
export type ModifierAxis = {
  /** The resolutionOrder-effective modifier name — also the input key. */
  name: string;
  /** Context names in declaration order. */
  contexts: readonly string[];
  /** The declared `default`, or `undefined` when the modifier has none. */
  default: string | undefined;
  /**
   * The context this axis sits at in the base permutation: the declared
   * `default`, else the first declared context.
   */
  base: string;
  description?: string;
  $extensions?: Rec;
};

export type AxisCoordinate = { axis: string; context: string };

/** One point in the product: a context for every axis. */
export type Permutation = {
  /**
   * Stable identity, e.g. `"theme=dark&density=compact"`. Every axis appears,
   * in resolutionOrder order, so two ids are comparable as strings.
   */
  id: string;
  /** Modifier name → context name. One entry per axis. */
  inputs: Readonly<ResolverInputs>;
  /** The axes whose context differs from `axis.base`, in axis order. */
  deviations: readonly AxisCoordinate[];
  isBase: boolean;
};

export type EnumerateOptions = {
  /**
   * Ceiling on the size of the cartesian product. Above it, only the base and
   * the single-axis variations are enumerated, `truncated` is set, and a
   * `permutation-limit` error names the real total. Defaults to 512.
   */
  maxPermutations?: number;
  /**
   * Restrict an axis to a subset of its contexts. An empty array pins the axis
   * to its base. Keys and values are matched case-insensitively, like inputs.
   */
  axes?: Record<string, readonly string[]>;
};

export type ResolvedPermutation = {
  permutation: Permutation;
  resolved: ResolvedResolverDocument;
};

function isPlainObject(value: unknown): value is Rec {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** Build the axes from an already-validated resolution order. */
function axesFromOrder(order: ResolutionOrder): {
  axes: ModifierAxis[];
  errors: PermutationError[];
} {
  const axes: ModifierAxis[] = [];
  const errors: PermutationError[] = [];

  for (const entry of order.entries) {
    if (entry.kind !== "modifier") continue;
    const contextMap = isPlainObject(entry.def.contexts) ? entry.def.contexts : {};
    const contexts = Object.keys(contextMap);
    // A modifier with no contexts contributes nothing to resolution and
    // already raised `modifier-no-contexts`; it isn't an axis.
    if (contexts.length === 0) continue;

    const declared = typeof entry.def.default === "string" ? entry.def.default : undefined;
    const matched =
      declared === undefined
        ? undefined
        : contexts.find((c) => c.toLowerCase() === declared.toLowerCase());

    // No usable default: fall back to the first context rather than refusing
    // to enumerate. `resolveResolverDocument` would raise
    // `missing-required-input` here, but a stylesheet still needs a base
    // block — and an explicit input always overrides the guess.
    const base = matched ?? contexts[0]!;
    if (matched === undefined) {
      errors.push({
        kind: "no-default-context",
        at: entry.at,
        message:
          declared === undefined
            ? `Modifier "${entry.name}" declares no default; using its first context "${base}" as the base.`
            : `Modifier "${entry.name}" declares default "${declared}", which is not one of its contexts; using "${base}" as the base.`,
      });
    }

    axes.push({
      name: entry.name,
      contexts,
      default: matched,
      base,
      description:
        typeof entry.def.description === "string" ? entry.def.description : undefined,
      $extensions: isPlainObject(entry.def.$extensions) ? entry.def.$extensions : undefined,
    });
  }

  return { axes, errors };
}

/**
 * Read the modifier axes out of a resolver document, following `$ref`s and
 * respecting `resolutionOrder`.
 *
 * Never throws; a document the schema rejects yields no axes and reports the
 * failure through `documentErrors`.
 */
export function modifierAxes(document: unknown): {
  axes: ModifierAxis[];
  documentErrors: ResolverModuleError[];
  errors: PermutationError[];
} {
  const order = buildResolutionOrder(document);
  const { axes, errors } = axesFromOrder(order);
  return { axes, documentErrors: order.errors, errors };
}

/** Apply the `axes` option, narrowing each axis to the requested contexts. */
function restrictAxes(
  axes: readonly ModifierAxis[],
  requested: Record<string, readonly string[]> | undefined,
): { axes: ModifierAxis[]; errors: PermutationError[] } {
  if (!requested) return { axes: [...axes], errors: [] };

  const errors: PermutationError[] = [];
  const byLowerName = new Map(axes.map((a) => [a.name.toLowerCase(), a]));

  for (const key of Object.keys(requested)) {
    if (!byLowerName.has(key.toLowerCase())) {
      errors.push({
        kind: "unknown-axis",
        at: `axes.${key}`,
        message: `"${key}" does not name a modifier in resolutionOrder.`,
      });
    }
  }

  const out = axes.map((axis) => {
    const key = Object.keys(requested).find((k) => k.toLowerCase() === axis.name.toLowerCase());
    if (key === undefined) return axis;

    const wanted = requested[key] ?? [];
    // An empty list pins the axis to its base coordinate.
    if (wanted.length === 0) return { ...axis, contexts: [axis.base] };

    const kept: string[] = [];
    for (const context of wanted) {
      const match = axis.contexts.find((c) => c.toLowerCase() === context.toLowerCase());
      if (match === undefined) {
        errors.push({
          kind: "unknown-context",
          at: `axes.${key}`,
          message: `"${context}" is not a context of modifier "${axis.name}"; expected one of ${axis.contexts.join(", ")}.`,
        });
        continue;
      }
      if (!kept.includes(match)) kept.push(match);
    }

    if (kept.length === 0) return { ...axis, contexts: [axis.base] };
    // Keep the base reachable so there is always a `:root` to emit against.
    if (!kept.includes(axis.base)) kept.unshift(axis.base);
    // Preserve declaration order rather than the order the caller listed.
    return { ...axis, contexts: axis.contexts.filter((c) => kept.includes(c)) };
  });

  return { axes: out, errors };
}

function makePermutation(
  axes: readonly ModifierAxis[],
  inputs: ResolverInputs,
): Permutation {
  const deviations: AxisCoordinate[] = [];
  const parts: string[] = [];
  for (const axis of axes) {
    const context = inputs[axis.name]!;
    parts.push(`${axis.name}=${context}`);
    if (context !== axis.base) deviations.push({ axis: axis.name, context });
  }
  return {
    id: parts.join("&"),
    inputs: Object.freeze({ ...inputs }),
    deviations,
    isBase: deviations.length === 0,
  };
}

/**
 * The cartesian product of the axes, base first then ascending deviation
 * count. Pure: enumerates coordinates without resolving anything.
 *
 * When the product exceeds `maxPermutations` the result degrades to the base
 * plus every single-axis variation — enough to emit per-context deltas, but
 * not enough to detect interactions between modifiers. That degradation is
 * always reported, never silent.
 */
export function enumeratePermutations(
  axes: readonly ModifierAxis[],
  options: EnumerateOptions = {},
): {
  permutations: Permutation[];
  base: Permutation;
  /** Size of the full product, whether or not it was enumerated. */
  total: number;
  truncated: boolean;
  errors: PermutationError[];
} {
  const { axes: effective, errors } = restrictAxes(axes, options.axes);
  const max = options.maxPermutations ?? DEFAULT_MAX_PERMUTATIONS;

  const baseInputs: ResolverInputs = {};
  for (const axis of effective) baseInputs[axis.name] = axis.base;
  const base = makePermutation(effective, baseInputs);

  const total = effective.reduce((n, axis) => n * axis.contexts.length, 1);

  if (total > max) {
    const permutations = [base];
    for (const axis of effective) {
      for (const context of axis.contexts) {
        if (context === axis.base) continue;
        permutations.push(makePermutation(effective, { ...baseInputs, [axis.name]: context }));
      }
    }
    errors.push({
      kind: "permutation-limit",
      at: "(document)",
      message: `${total} permutations across ${effective.length} modifier(s) (${effective
        .map((a) => `${a.name}×${a.contexts.length}`)
        .join(", ")}) exceeds maxPermutations=${max}; enumerated the base and ${
        permutations.length - 1
      } single-axis variation(s) only. Interactions between modifiers were not checked.`,
    });
    return { permutations, base, total, truncated: true, errors };
  }

  // Odometer over the axes, rightmost varying fastest.
  const permutations: Permutation[] = [];
  const walk = (index: number, inputs: ResolverInputs): void => {
    const axis = effective[index];
    if (axis === undefined) {
      permutations.push(makePermutation(effective, inputs));
      return;
    }
    for (const context of axis.contexts) {
      walk(index + 1, { ...inputs, [axis.name]: context });
    }
  };
  walk(0, {});

  // Ascending deviation count, ties broken by product order — so a consumer
  // layering blocks in list order never sees a broader block after a narrower
  // one that refines it.
  const rank = new Map(permutations.map((p, i) => [p.id, i]));
  permutations.sort(
    (a, b) =>
      a.deviations.length - b.deviations.length || rank.get(a.id)! - rank.get(b.id)!,
  );

  // Hand back the instance the odometer produced rather than the one built to
  // seed it, so `base` is identical to `permutations[0]` and not merely equal.
  // Every axis keeps its base context reachable, so this always finds it.
  return { permutations, base: permutations.find((p) => p.isBase) ?? base, total, truncated: false, errors };
}

export type ResolvedPermutations = {
  axes: ModifierAxis[];
  base: ResolvedPermutation;
  /** Base first, then ascending deviation count. */
  all: ResolvedPermutation[];
  byId: Map<string, ResolvedPermutation>;
  /** Size of the full product, whether or not every point was resolved. */
  total: number;
  truncated: boolean;
  /** Diagnostics from the document itself, reported once rather than per point. */
  documentErrors: ResolverModuleError[];
  errors: PermutationError[];
};

/**
 * Enumerate and resolve every permutation of a resolver document.
 *
 * The document is validated and its `resolutionOrder` walked exactly once;
 * each permutation reuses that work, so the per-point cost is a merge plus an
 * alias pass rather than a full arktype run.
 */
export function resolvePermutations(
  document: unknown,
  options: EnumerateOptions & ResolveResolverOptions = {},
): ResolvedPermutations {
  const order = buildResolutionOrder(document);
  const { axes, errors: axisErrors } = axesFromOrder(order);
  const {
    permutations,
    base: basePermutation,
    total,
    truncated,
    errors: enumerateErrors,
  } = enumeratePermutations(axes, options);

  const resolveOptions: ResolveResolverOptions = {
    externalDocuments: options.externalDocuments,
  };

  const all: ResolvedPermutation[] = permutations.map((permutation) => ({
    permutation,
    resolved: resolveFromOrder(order, { ...permutation.inputs }, resolveOptions),
  }));

  const byId = new Map(all.map((entry) => [entry.permutation.id, entry]));
  // `enumeratePermutations` always emits the base first, and the odometer
  // always contains it, so this lookup cannot miss.
  const base = byId.get(basePermutation.id)!;

  return {
    axes,
    base,
    all,
    byId,
    total,
    truncated,
    documentErrors: order.errors,
    errors: [...axisErrors, ...enumerateErrors],
  };
}
