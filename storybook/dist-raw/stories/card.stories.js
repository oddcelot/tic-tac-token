import { parseTokens, tokenDocumentFromParameters } from "../tokens.js";
import { tokenCardTag } from "../../components/index.js";
import raw from "../tokens.json?raw";

export default {
  title: "Tokens/Card",
  component: tokenCardTag,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        story:
          "A sample component rendered entirely from the active theme's tokens. " +
          "token-card derives CSS custom properties from the resolved token document " +
          "(via the pure @oddsquad/tic-tac-token/css helper) and consumes only stable " +
          "role vars — --color-primary, --color-accent, --spacing-card, " +
          "--spacing-radius, --font-family-sans, --font-weight-bold — so the same " +
          "markup follows the current theme × color scheme.",
      },
    },
  },
  args: { mode: "light" },
  argTypes: {
    mode: {
      control: { type: "inline-radio" },
      options: ["light", "dark"],
      description: "Pick the token scheme to render (light or dark mode variants).",
      table: { defaultValue: { summary: "light" } },
    },
  },
  render: (args, context) => {
    const doc = tokenDocumentFromParameters(context) ?? raw;
    const mode = (args.mode ?? "light") === "dark" ? "dark" : "light";
    const el = document.createElement(tokenCardTag);
    Object.assign(el, {
      mode,
      tokens: parseTokens(doc, mode),
    });
    return el;
  },
};

export const Light = {};
export const Dark = { args: { mode: "dark" } };