// Mapping a modifier context onto a CSS condition.
//
// The Resolver Module says nothing about how `theme=dark` should be selected
// for — that's a target-specific decision, and the same document might drive a
// stylesheet, an iOS theme and a Figma variable collection. So the mapping is
// configurable, with a convention that needs no configuration at all.
//
// Two sources, option first:
//
//   1. the `selectors` emitter option, keyed by modifier name;
//   2. `modifiers.<name>.$extensions["tic-tac-token.css"]` in the document;
//   3. failing both, `[data-<modifier>="<context>"]`.
//
// Reading it from the document keeps the theming intent travelling with the
// tokens; letting the option win keeps a document that never mentions CSS
// perfectly usable.
import { kebabCase } from "./names.ts";

/** The `$extensions` key a resolver document uses to describe CSS output. */
export const CSS_EXTENSION = "tic-tac-token.css";

export type ContextSelector =
  /** The root selector alone — the context adds no further condition. */
  | { kind: "root" }
  /** `[attribute="value"]`; `value` defaults to the context name. */
  | { kind: "attribute"; attribute: string; value?: string }
  /** `.className`; defaults to `<modifier>-<context>`. */
  | { kind: "class"; className?: string }
  /** `@media (…)`. */
  | { kind: "media"; query: string }
  /** `@supports (…)`. */
  | { kind: "supports"; condition: string }
  /** Appended to the accumulated selector verbatim. */
  | { kind: "selector"; selector: string };

/**
 * One condition, or several alternatives that each get the same declarations.
 *
 * The array form is how "follow the system preference, but let an explicit
 * choice win" is expressed:
 *
 * ```jsonc
 * "dark": [
 *   { "kind": "media", "query": "(prefers-color-scheme: dark)" },
 *   { "kind": "attribute", "attribute": "data-theme", "value": "dark" }
 * ]
 * ```
 */
export type ContextSelectors = ContextSelector | readonly ContextSelector[];

export type SelectorStrategy =
  /** One template for every context of the axis. */
  | ContextSelectors
  /** Per-context map, keyed by context name. */
  | Record<string, ContextSelectors>
  | ((axis: SelectorAxis, context: string) => ContextSelectors);

/** The part of a modifier axis this module needs. `ModifierAxis` satisfies it. */
export type SelectorAxis = {
  name: string;
  contexts: readonly string[];
  base: string;
  $extensions?: Record<string, unknown>;
};

export type SelectorDiagnostic = {
  kind: "invalid-selector-extension";
  at: string;
  message: string;
};

/** A rendered condition: a selector plus the at-rules it must nest inside. */
export type RenderedCondition = {
  selector: string;
  /** Outermost first, e.g. `["@media (prefers-color-scheme: dark)"]`. */
  atRules: string[];
};

const SELECTOR_KINDS = new Set([
  "root",
  "attribute",
  "class",
  "media",
  "supports",
  "selector",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isContextSelector(value: unknown): value is ContextSelector {
  return isRecord(value) && typeof value.kind === "string" && SELECTOR_KINDS.has(value.kind);
}

/** Validate a `$extensions["tic-tac-token.css"]` payload into a strategy. */
export function selectorStrategyFromExtensions(
  axis: SelectorAxis,
  diagnostics: SelectorDiagnostic[],
): SelectorStrategy | undefined {
  const raw = axis.$extensions?.[CSS_EXTENSION];
  if (raw === undefined) return undefined;

  const at = `modifiers.${axis.name}.$extensions["${CSS_EXTENSION}"]`;
  if (!isRecord(raw)) {
    diagnostics.push({
      kind: "invalid-selector-extension",
      at,
      message: `Expected an object; got ${Array.isArray(raw) ? "an array" : typeof raw}.`,
    });
    return undefined;
  }

  // A single ContextSelector, applied to every context.
  if (isContextSelector(raw)) return raw;

  // Otherwise a per-context map. Non-context keys (`colorScheme`, and anything
  // a future revision adds) are metadata, not selectors, and are skipped.
  const out: Record<string, ContextSelectors> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!axis.contexts.includes(key)) continue;
    if (isContextSelector(value)) {
      out[key] = value;
      continue;
    }
    if (Array.isArray(value) && value.length > 0 && value.every(isContextSelector)) {
      out[key] = value as ContextSelector[];
      continue;
    }
    diagnostics.push({
      kind: "invalid-selector-extension",
      at: `${at}.${key}`,
      message:
        "Expected a selector object with a `kind` of root | attribute | class | media | supports | selector, or a non-empty array of them.",
    });
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

/** The default: one attribute per axis, holding the active context. */
export function defaultSelector(axis: SelectorAxis, context: string): ContextSelector {
  return { kind: "attribute", attribute: `data-${kebabCase(axis.name)}`, value: context };
}

function resolveStrategy(
  strategy: SelectorStrategy | undefined,
  axis: SelectorAxis,
  context: string,
): ContextSelector[] {
  if (strategy === undefined) return [defaultSelector(axis, context)];
  if (typeof strategy === "function") return toArray(strategy(axis, context));
  if (Array.isArray(strategy)) return [...(strategy as readonly ContextSelector[])];
  if (isContextSelector(strategy)) return [strategy];

  const perContext = (strategy as Record<string, ContextSelectors>)[context];
  if (perContext === undefined) return [defaultSelector(axis, context)];
  return toArray(perContext);
}

function toArray(value: ContextSelectors): ContextSelector[] {
  return Array.isArray(value) ? [...value] : [value as ContextSelector];
}

/** Quote and escape a value for use inside an attribute selector. */
function attributeValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/** Escape a class name for use in a selector. */
function className(value: string): string {
  return value.replace(/[^\w-]/g, (c) => `\\${c}`);
}

/** True when the variant needs no at-rule — i.e. it is an unconditional match. */
function isPlainVariant(parts: readonly ContextSelector[]): boolean {
  return parts.every((p) => p.kind !== "media" && p.kind !== "supports");
}

/**
 * Render a set of axis coordinates into the CSS conditions that select them.
 *
 * Multiple coordinates compound: their selector parts concatenate onto
 * `rootSelector` and their at-rules nest. When any axis offers several
 * alternative selectors, the cross-product is returned — one rendered
 * condition per combination, all carrying the same declarations.
 *
 * **Ordering matters.** Variants that need no at-rule are emitted *last*, so an
 * explicit `[data-theme="light"]` still wins on a machine whose OS prefers
 * dark. Getting this backwards is the classic way a manual theme toggle
 * silently stops working.
 */
export function renderConditions(
  conditions: readonly { axis: string; context: string }[],
  axes: readonly SelectorAxis[],
  strategies: ReadonlyMap<string, SelectorStrategy | undefined>,
  rootSelector: string,
): RenderedCondition[] {
  if (conditions.length === 0) return [{ selector: rootSelector, atRules: [] }];

  const byName = new Map(axes.map((a) => [a.name, a]));

  // Alternatives per coordinate, then the cross-product across coordinates.
  const perCoordinate = conditions.map(({ axis, context }) => {
    const found = byName.get(axis) ?? { name: axis, contexts: [context], base: context };
    return resolveStrategy(strategies.get(axis), found, context);
  });

  let combos: ContextSelector[][] = [[]];
  for (const alternatives of perCoordinate) {
    combos = combos.flatMap((combo) => alternatives.map((alt) => [...combo, alt]));
  }

  const rendered = combos.map((parts) => {
    let selector = rootSelector;
    const atRules: string[] = [];
    const media: string[] = [];

    for (const part of parts) {
      switch (part.kind) {
        case "root":
          break;
        case "attribute":
          selector += `[${part.attribute}=${attributeValue(part.value ?? "")}]`;
          break;
        case "class":
          selector += `.${className(part.className ?? "")}`;
          break;
        case "selector":
          selector += part.selector;
          break;
        case "media":
          media.push(part.query);
          break;
        case "supports":
          atRules.push(`@supports ${part.condition}`);
          break;
      }
    }

    // Several media conditions on one block are a conjunction, not nesting.
    if (media.length > 0) atRules.unshift(`@media ${media.join(" and ")}`);
    return { selector, atRules };
  });

  // At-rule-gated variants first; unconditional ones last so they win.
  return [
    ...rendered.filter((_, i) => !isPlainVariant(combos[i]!)),
    ...rendered.filter((_, i) => isPlainVariant(combos[i]!)),
  ];
}

/**
 * Build the per-axis strategy map an emitter passes to `renderConditions`:
 * the option when given, else the document's `$extensions`, else undefined
 * (which `renderConditions` reads as "use the default convention").
 */
export function selectorStrategies(
  axes: readonly SelectorAxis[],
  options: {
    selectors?: Record<string, SelectorStrategy>;
    useDocumentSelectors?: boolean;
  },
  diagnostics: SelectorDiagnostic[],
): Map<string, SelectorStrategy | undefined> {
  const useDocument = options.useDocumentSelectors !== false;
  const map = new Map<string, SelectorStrategy | undefined>();

  for (const axis of axes) {
    const override = options.selectors?.[axis.name];
    if (override !== undefined) {
      map.set(axis.name, override);
      continue;
    }
    map.set(
      axis.name,
      useDocument ? selectorStrategyFromExtensions(axis, diagnostics) : undefined,
    );
  }

  return map;
}

/**
 * Whether a modifier is the one driving the document's color scheme, marked
 * `{ "colorScheme": true }` in its CSS extension. A consumer uses this to set
 * `color-scheme` so the browser matches native UI — scrollbars, form controls
 * — to the active context.
 */
export function isColorSchemeAxis(axis: SelectorAxis): boolean {
  const raw = axis.$extensions?.[CSS_EXTENSION];
  return isRecord(raw) && raw.colorScheme === true;
}
