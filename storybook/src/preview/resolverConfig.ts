// Deriving the addon's toolbar from a resolver document's modifiers.
//
// Every modifier becomes one toolbar dropdown: its contexts are the items, its
// `default` is the initial value, and the global's name is the input key the
// resolver expects. So adding a `density` modifier to the document adds a
// Density dropdown to Storybook with no addon change.
//
// Pure — no DOM, no Storybook imports beyond types. `./applyTheme.ts` owns the
// side effects.
import { resolverModifiers } from "@oddsquad/tic-tac-token/resolver-module";
import type {
  ResolverInputs,
  ResolverModifierInfo,
} from "@oddsquad/tic-tac-token/resolver-module";
import { isColorSchemeAxis } from "@oddsquad/tic-tac-token/css";

/**
 * The `$extensions` key a resolver document uses to configure this addon.
 * Purely presentational — a document without it still gets a full toolbar.
 */
export const STORYBOOK_EXT = "tic-tac-token.storybook";

export type StorybookModifierExt = {
  /** Toolbar dropdown label. Defaults to a title-cased modifier name. */
  title?: string;
  /**
   * Override the toolbar global's name. Useful when a modifier called `theme`
   * would collide with another addon's `theme` global.
   */
  global?: string;
  /** Context name → toolbar item label. */
  labels?: Record<string, string>;
  /** `data-*` attribute to mirror the active context onto, or `false` to skip. */
  attribute?: string | false;
};

/** The shape of a Storybook toolbar entry. Structural, to avoid a hard dependency. */
export type ToolbarArgType = {
  description?: string;
  toolbar: {
    title: string;
    items: { value: string; title: string }[];
    dynamicTitle?: boolean;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function storybookExt(modifier: ResolverModifierInfo): StorybookModifierExt {
  const raw = modifier.$extensions?.[STORYBOOK_EXT];
  return isRecord(raw) ? (raw as StorybookModifierExt) : {};
}

/** `colorScheme` → `Color scheme`, `theme` → `Theme`. */
export function titleCase(name: string): string {
  const spaced = name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[-_]+/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

/** The toolbar global name a modifier claims. */
export function globalNameFor(modifier: ResolverModifierInfo): string {
  return storybookExt(modifier).global ?? modifier.name;
}

/** The context a modifier starts at: its declared default, else its first context. */
export function initialContextFor(modifier: ResolverModifierInfo): string | undefined {
  return modifier.default ?? modifier.contexts[0];
}

/**
 * One toolbar dropdown per modifier reachable through `resolutionOrder`.
 *
 * Deliberately keyed off `resolverModifiers` rather than `document.modifiers`:
 * a modifier that is declared but never referenced would produce a dropdown
 * whose value the resolver rejects with `unknown-input-key`.
 */
export function tokenGlobalTypes(document: unknown): Record<string, ToolbarArgType> {
  const out: Record<string, ToolbarArgType> = {};

  for (const modifier of resolverModifiers(document)) {
    if (modifier.contexts.length === 0) continue;
    const ext = storybookExt(modifier);
    out[globalNameFor(modifier)] = {
      description: modifier.description,
      toolbar: {
        title: ext.title ?? titleCase(modifier.name),
        items: modifier.contexts.map((context) => ({
          value: context,
          title: ext.labels?.[context] ?? titleCase(context),
        })),
        dynamicTitle: true,
      },
    };
  }

  return out;
}

/** The initial value for each derived global. */
export function tokenInitialGlobals(document: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  for (const modifier of resolverModifiers(document)) {
    const initial = initialContextFor(modifier);
    if (initial !== undefined) out[globalNameFor(modifier)] = initial;
  }
  return out;
}

/**
 * Turn the active globals into resolver inputs.
 *
 * Only modifiers the document actually declares are read, and only values that
 * name one of their contexts — so an unrelated global (another addon's, or a
 * stale URL parameter) can never reach the resolver as `unknown-input-key`.
 */
export function inputsFromGlobals(
  document: unknown,
  globals: Record<string, unknown> | undefined,
): ResolverInputs {
  const inputs: ResolverInputs = {};

  for (const modifier of resolverModifiers(document)) {
    const supplied = globals?.[globalNameFor(modifier)];
    const wanted =
      typeof supplied === "string"
        ? modifier.contexts.find((c) => c.toLowerCase() === supplied.toLowerCase())
        : undefined;
    const value = wanted ?? initialContextFor(modifier);
    if (value !== undefined) inputs[modifier.name] = value;
  }

  return inputs;
}

/**
 * The modifier that drives the document's color scheme, if any.
 *
 * Two tiers: an explicit `{ "colorScheme": true }` in the modifier's
 * `tic-tac-token.css` extension wins, so a modifier called `appearance` or
 * `mode` can opt in and one called `colorScheme` can opt out. Absent any
 * marker, the conventional name is matched — which covers the overwhelmingly
 * common case with no configuration at all.
 */
export function colorSchemeModifier(document: unknown): ResolverModifierInfo | undefined {
  const modifiers = resolverModifiers(document);

  const marked = modifiers.find((m) =>
    isColorSchemeAxis({
      name: m.name,
      contexts: m.contexts,
      base: initialContextFor(m) ?? "",
      $extensions: m.$extensions,
    }),
  );
  if (marked) return marked;

  return modifiers.find((m) => /^color[-_]?scheme$/i.test(m.name));
}

/** The `data-*` attribute a modifier's active context is mirrored onto. */
export function attributeFor(modifier: ResolverModifierInfo): string | undefined {
  const configured = storybookExt(modifier).attribute;
  if (configured === false) return undefined;
  if (typeof configured === "string") return configured;
  return `data-${modifier.name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()}`;
}
