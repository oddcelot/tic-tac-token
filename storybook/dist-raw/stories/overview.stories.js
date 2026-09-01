import { parseTokens, tokenDocumentFromParameters } from "../tokens.js";
import { tokenGalleryTag } from "../../components/index.js";
import raw from "../tokens.json?raw";

export default {
  title: "Tokens/Overview",
  component: tokenGalleryTag,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        story:
          "Every supported token type in one place, grouped into sections by the tokens-gallery element.",
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
    const el = document.createElement(tokenGalleryTag);
    const scheme = context.globals?.colorScheme ?? args.mode ?? "light";
    Object.assign(el, {
      tokens: parseTokens(doc, scheme === "dark" ? "dark" : "light"),
    });
    return el;
  },
};

export const Light = {};
export const Dark = { args: { mode: "dark" } };