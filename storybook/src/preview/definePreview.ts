// The consumer-facing entry point: one call in `.storybook/preview.ts` that
// derives the whole addon setup from a resolver document.
//
// Why a factory the consumer calls, rather than the preset baking this in:
// `globalTypes` must be a *static export* of a preview annotation, evaluated
// before any story parameter is read. `.storybook/preview.ts` is such an
// annotation — one the consumer already edits and already imports tokens into
// — so a call there is as static as a literal. Deriving it in the preset
// instead would need a virtual module, a `viteFinal`, a second source of truth
// in `main.ts`, and a Node-side config reload on every token edit.
import type { Decorator } from "@storybook/web-components-vite";
import { applyTokenTheme, type ApplyOptions } from "./applyTheme.ts";
import {
  tokenGlobalTypes,
  tokenInitialGlobals,
  type ToolbarArgType,
} from "./resolverConfig.ts";
import { PARAM_KEY, registerTokenSource } from "./tokens.ts";
import type { TokenParameterSource } from "./tokens.ts";

export type TokenPreviewOptions = ApplyOptions & {
  /** A parsed DTCG Resolver Module document. */
  resolver?: unknown;
  /** Pre-parsed docs for external `$ref`s, keyed by the pointer's pre-`#` URI. */
  externalDocuments?: Record<string, unknown>;
  /** Legacy: a single raw DTCG document. Ignored when `resolver` is set. */
  raw?: string;
  /** Legacy: theme name → raw DTCG document. Ignored when `resolver` is set. */
  documents?: Record<string, string>;
  /** Merged after the derived globals — the consumer wins. */
  globalTypes?: Record<string, ToolbarArgType>;
  initialGlobals?: Record<string, string>;
};

export type TokenPreviewAnnotations = {
  globalTypes: Record<string, ToolbarArgType>;
  initialGlobals: Record<string, string>;
  decorators: Decorator[];
  parameters: Record<string, unknown>;
};

/**
 * Build the preview annotations for a resolver document: one toolbar dropdown
 * per modifier, plus a decorator that applies the selected combination.
 *
 * The return value is a plain object, so it works in both consumer styles:
 *
 * ```ts
 * // classic
 * export default { ...tokenPreviewAddon({ resolver }), tags: ["autodocs"] };
 * // CSF factories
 * export default definePreview({ addons: [tokenPreviewAddon({ resolver })] });
 * ```
 */
export function tokenPreviewAddon(
  options: TokenPreviewOptions = {},
): TokenPreviewAnnotations {
  const { resolver, externalDocuments, raw, documents, cssSelector, attributes } = options;

  const parameters: Record<string, unknown> =
    resolver !== undefined
      ? { [PARAM_KEY]: { resolver, externalDocuments: externalDocuments ?? {} } }
      : documents !== undefined
        ? { [PARAM_KEY]: { documents } }
        : raw !== undefined
          ? { [PARAM_KEY]: { raw } }
          : {};

  // Also register the source directly, so the addon keeps working if the
  // consumer's own `parameters` key overwrites the one returned above.
  const source: TokenParameterSource | undefined =
    resolver !== undefined
      ? { kind: "resolver", document: resolver, externalDocuments: externalDocuments ?? {} }
      : raw !== undefined
        ? { kind: "document", raw }
        : undefined;
  registerTokenSource(source);

  // The legacy shapes carry no modifiers, so they keep the two globals the
  // addon has always registered rather than deriving none.
  const derivedGlobalTypes =
    resolver !== undefined ? tokenGlobalTypes(resolver) : legacyGlobalTypes(documents);
  const derivedInitialGlobals =
    resolver !== undefined ? tokenInitialGlobals(resolver) : legacyInitialGlobals(documents);

  const decorator: Decorator = (story, context) => {
    applyTokenTheme(context as never, { cssSelector, attributes });
    return story();
  };

  return {
    globalTypes: { ...derivedGlobalTypes, ...options.globalTypes },
    initialGlobals: { ...derivedInitialGlobals, ...options.initialGlobals },
    decorators: [decorator],
    parameters,
  };
}

function legacyGlobalTypes(
  documents: Record<string, string> | undefined,
): Record<string, ToolbarArgType> {
  const out: Record<string, ToolbarArgType> = {
    colorScheme: {
      description: "Light or dark color scheme within the active theme.",
      toolbar: {
        title: "Color scheme",
        items: [
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
        ],
        dynamicTitle: true,
      },
    },
  };

  const names = Object.keys(documents ?? {});
  if (names.length > 0) {
    out["theme"] = {
      description: "Which theme's token document to render.",
      toolbar: {
        title: "Theme",
        items: names.map((name) => ({
          value: name,
          title: name.charAt(0).toUpperCase() + name.slice(1),
        })),
        dynamicTitle: true,
      },
    };
  }

  return out;
}

function legacyInitialGlobals(
  documents: Record<string, string> | undefined,
): Record<string, string> {
  const names = Object.keys(documents ?? {});
  const out: Record<string, string> = { colorScheme: "light" };
  if (names[0] !== undefined) out["theme"] = names[0];
  return out;
}

/**
 * Normalise a Vite `import.meta.glob` result into the `externalDocuments` map.
 *
 * The keys must match the pre-`#` portion of the `$ref`s in the resolver
 * document, and a glob's keys are relative to the importing module — so
 * `../tokens/base.json` has to become `tokens/base.json`. Getting that wrong
 * fails as `No external document supplied for "tokens/base.json"`, which is
 * not an obvious thing to debug, hence this helper.
 */
export function externalDocumentsFrom(
  modules: Record<string, unknown>,
  options: { stripPrefix?: string } = {},
): Record<string, unknown> {
  const prefix = options.stripPrefix ?? "../";
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(modules)) {
    let path = key;
    while (path.startsWith(prefix)) path = path.slice(prefix.length);
    out[path.replace(/^\.\//, "")] = value;
  }
  return out;
}
