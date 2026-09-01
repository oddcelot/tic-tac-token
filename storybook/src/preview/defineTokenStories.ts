import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { parseTokens, tokensOfType } from "./tokens.ts";
import type { TokenMode, TokenType } from "./tokens.ts";
import "../components/index.ts";

const TAG_BY_TYPE: Partial<Record<TokenType, string>> = {
  color: "token-color",
  fontFamily: "token-font-family",
  fontWeight: "token-font-weight",
  dimension: "token-dimension",
};

export type TokenStoryOptions = {
  /** Storybook sidebar path, e.g. `"Tokens/Color"`. */
  title: string;
  /** Raw DTCG tokens document text (see `?raw` imports). */
  raw: string;
  /** Only tokens of this type are rendered by the stories. */
  type: TokenType;
  /** Short description shown in autodocs. */
  description?: string;
  parameters?: Meta["parameters"];
};

export type TokenStories = {
  meta: Meta;
  /** Primary story. */
  Default: StoryObj;
  /** Dark-mode story (color only). */
  Dark?: StoryObj;
};

/** Create a showcase element for a token type with parsed token data + args. */
function createElement(
  tag: string,
  tokens: ReturnType<typeof tokensOfType>,
  args: Record<string, unknown>,
): HTMLElement {
  const el = document.createElement(tag);
  Object.assign(el, { tokens });
  for (const key of ["mode", "sample"] as const) {
    if (key in args) Object.assign(el, { [key]: args[key] });
  }
  return el;
}

/**
 * Build the CSF exports for a single token type from a raw tokens document.
 *
 * The returned `meta` is meant for `export default` and the story objects
 * are meant for named exports in a `.stories.ts` file:
 *
 * ```ts
 * import { defineTokenStories } from "@oddsquad/tic-tac-token-storybook/stories";
 * import raw from "../tokens/tokens.json?raw";
 *
 * const s = defineTokenStories({ title: "Tokens/Color", raw, type: "color" });
 * export default s.meta;
 * export const Default = s.Default;
 * export const Dark = s.Dark;
 * ```
 */
export function defineTokenStories(options: TokenStoryOptions): TokenStories {
  const { title, raw, type, description, parameters } = options;
  const tag = TAG_BY_TYPE[type];
  if (!tag) {
    throw new Error(
      `defineTokenStories: no showcase component registered for token type "${type}".`,
    );
  }

  const base: Meta = {
    title,
    component: tag,
    tags: ["autodocs"],
    parameters: {
      ...parameters,
      ...(description ? { docs: { description: { story: description } } } : {}),
    },
    render: (args: Record<string, unknown>) =>
      createElement(tag, tokensOfType(parseTokens(raw, (args["mode"] as TokenMode) ?? "light"), type), args),
  };

  switch (type) {
    case "color":
      return {
        meta: {
          ...base,
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
        },
        Default: { args: { mode: "light" } },
        Dark: { name: "Dark", args: { mode: "dark" } },
      };
    case "fontFamily":
    case "fontWeight":
    case "dimension":
      return {
        meta: {
          ...base,
          argTypes: {
            sample: {
              control: { type: "text" },
              description: "Sample text rendered with the token value.",
            },
          },
        },
        Default: {},
      };
    default:
      return { meta: base, Default: {} };
  }
}