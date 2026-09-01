// The story is the thin glue: it resolves the active theme's raw token document
// from the global parameter (addon-provided) and hands it to the demo's own
// TokenCard component, which does all token → CSS work through core's
// `tokensToCssVars()` — no addon involvement inside the component itself.
import { tokenDocumentFromParameters } from "@oddsquad/tic-tac-token-storybook/tokens";
import { tokenCardTag } from "./token-card";

export default {
  title: "Example/Card",
  component: tokenCardTag,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        story:
          "A sample component authored in the demo itself (src/token-card.ts). " +
          "It consumes the core @oddsquad/tic-tac-token API directly — " +
          "resolveTokens() + tokensToCssVars() — deriving CSS custom properties " +
          "from the active theme's token document and styling itself only from " +
          "stable role vars (--color-primary, --color-accent, …). The same " +
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
    const doc = tokenDocumentFromParameters(context);
    const el = document.createElement(tokenCardTag);
    Object.assign(el, {
      mode: (args.mode ?? "light") === "dark" ? "dark" : "light",
      document: doc ?? "",
    });
    if (!doc) {
      el.innerHTML = "<p style='color:#b00'>No token document — set the ticTacToken parameter.</p>";
    }
    return el;
  },
};

export const Light = {};
export const Dark = { args: { mode: "dark" } };