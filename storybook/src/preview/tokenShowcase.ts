import type { Meta } from "@storybook/web-components-vite";
import { parseTokens, tokensOfType } from "./tokens.ts";
import { resolveForContext } from "./resolve.ts";
import type { TokenMode, TokenType } from "./tokens.ts";
import "../components/index.ts";

const TAG_BY_TYPE: Partial<Record<TokenType, string>> = {
  color: "token-color",
  fontFamily: "token-font-family",
  fontWeight: "token-font-weight",
  dimension: "token-dimension",
};

/** Minimal story render context shape we read parameters/globals from. */
export type TokenRenderContext = {
  parameters?: Record<string, unknown>;
  globals?: Record<string, string | undefined>;
};

export type TokenDocumentSource =
  | string
  | ((args: Record<string, unknown>, context: TokenRenderContext) => string);

export type TokenShowcaseConfig = {
  /** Token type to showcase (color, fontFamily, fontWeight, dimension). */
  type: TokenType;
  /**
   * Raw DTCG tokens document text (see `?raw` imports), or a function that
   * reads it from the story render context.
   *
   * An explicit document *overrides* the project's tokens, so this is for a
   * hand-authored story that showcases one specific document. Leave it unset
   * to follow whatever the project supplied through `PARAM_KEY`.
   *
   * @deprecated Prefer a resolver document in `parameters[PARAM_KEY]`.
   */
  raw?: TokenDocumentSource;
  /**
   * Raw DTCG document to fall back on when the project supplied no tokens at
   * all. Unlike `raw`, this never shadows a project's own document — it is how
   * the addon's bundled stories stay useful in a project with no setup yet.
   */
  fallbackRaw?: string;
  /** Short description shown in autodocs. */
  description?: string;
  parameters?: Meta["parameters"];
};

export type TokenShowcase = {
  /** Custom-element tag to declare as the story's component. */
  component: string;
  /** Render function that mounts the showcase element with resolved tokens. */
  render: (args: Record<string, unknown>, context: TokenRenderContext) => HTMLElement;
  args?: Meta["args"];
  argTypes?: Meta["argTypes"];
  parameters?: Meta["parameters"];
};

/**
 * Build the render + controls pieces for a token type's stories.
 *
 * Storybook statically indexes CSF files, so consumers must hand the fields
 * to a literal default export:
 *
 * ```ts
 * import { tokenShowcase } from "@oddsquad/tic-tac-token-storybook/stories";
 * import raw from "../tokens/tokens.json?raw";
 *
 * const show = tokenShowcase({ type: "color", raw });
 *
 * export default {
 *   title: "Tokens/Color",
 *   component: show.component,
 *   render: show.render,
 *   args: show.args,
 *   argTypes: show.argTypes,
 * };
 * export const Dark = { args: { mode: "dark" } };
 * ```
 */
export function tokenShowcase(config: TokenShowcaseConfig): TokenShowcase {
  const { type, raw, fallbackRaw, description, parameters } = config;
  const tag = TAG_BY_TYPE[type];
  if (!tag) {
    throw new Error(
      `tokenShowcase: no showcase component registered for token type "${type}".`,
    );
  }

  const render = (
    args: Record<string, unknown>,
    context: TokenRenderContext,
  ): HTMLElement => {
    // A story that hands in its own raw document keeps the legacy path; that
    // is the only case where the `mode` argument still means anything.
    const explicit = typeof raw === "function" ? raw(args, context) : raw;
    const globalScheme = context.globals?.["colorScheme"];
    const mode: TokenMode =
      (globalScheme ?? args["mode"]) === "dark" ? "dark" : "light";

    // Otherwise resolve through the Resolver Module, at whatever contexts the
    // toolbar currently selects. `resolveForContext` handles the `{ resolver }`
    // shape and the legacy `{ raw }` / `{ documents }` ones alike, so there is
    // nothing to branch on here. The bundled fallback applies only when the
    // project supplied nothing — it must never shadow a real document.
    const resolved = explicit !== undefined ? [] : resolveForContext(context).tokens;
    const source =
      explicit !== undefined
        ? parseTokens(explicit, mode)
        : resolved.length > 0
          ? resolved
          : fallbackRaw !== undefined
            ? parseTokens(fallbackRaw, mode)
            : [];

    const tokens = tokensOfType(source, type);
    const el = document.createElement(tag);
    Object.assign(el, { tokens, mode });
    for (const key of ["sample"] as const) {
      if (key in args) Object.assign(el, { [key]: args[key] });
    }
    return el;
  };

  const docs = description
    ? { docs: { description: { story: description } } }
    : {};

  switch (type) {
    case "color":
      return {
        component: tag,
        render,
        args: { mode: "light" },
        argTypes: {
          mode: {
            control: { type: "inline-radio" },
            options: ["light", "dark"],
            description:
              "Pick the token scheme to render (light or dark mode variants).",
            table: { defaultValue: { summary: "light" } },
          },
        },
        parameters: { ...parameters, ...docs },
      };
    case "fontFamily":
    case "fontWeight":
    case "dimension":
      return {
        component: tag,
        render,
        argTypes: {
          sample: {
            control: { type: "text" },
            description: "Sample text rendered with the token value.",
          },
        },
        parameters: { ...parameters, ...docs },
      };
    default:
      return { component: tag, render, parameters: { ...parameters, ...docs } };
  }
}