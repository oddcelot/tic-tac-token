import type { Meta } from "@storybook/web-components-vite";
import { parseTokens, tokenDocumentFromParameters, tokensOfType } from "./tokens.ts";
import type { TokenMode, TokenType } from "./tokens.ts";
import "../components/index.ts";

const TAG_BY_TYPE: Partial<Record<TokenType, string>> = {
  color: "token-color",
  fontFamily: "token-font-family",
  fontWeight: "token-font-weight",
  dimension: "token-dimension",
};

/** Minimal story render context shape we read parameters from. */
export type TokenRenderContext = {
  parameters?: Record<string, unknown>;
};

export type TokenDocumentSource =
  | string
  | ((args: Record<string, unknown>, context: TokenRenderContext) => string);

export type TokenShowcaseConfig = {
  /** Token type to showcase (color, fontFamily, fontWeight, dimension). */
  type: TokenType;
  /**
   * Raw DTCG tokens document text (see `?raw` imports), or a resolver that
   * reads it from the story render context. When omitted, the addon falls
   * back to a project-provided global parameter (see `PARAM_KEY`) or its
   * bundled default token document.
   */
  raw?: TokenDocumentSource;
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
  const { type, raw, description, parameters } = config;
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
    const mode: TokenMode = args["mode"] === "dark" ? "dark" : "light";
    const doc =
      typeof raw === "function"
        ? raw(args, context)
        : raw ?? tokenDocumentFromParameters(context) ?? "";
    const tokens = tokensOfType(parseTokens(doc, mode), type);
    const el = document.createElement(tag);
    Object.assign(el, { tokens });
    for (const key of ["mode", "sample"] as const) {
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