import { tokenGalleryTag } from "@oddsquad/tic-tac-token-storybook/components";
import { parseTokens } from "@oddsquad/tic-tac-token-storybook/tokens";
import type { Meta, StoryObj } from "@storybook/web-components-vite";
import raw from "../tokens/tokens.json?raw";

const meta: Meta = {
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
  render: (args) => {
    const el = document.createElement(tokenGalleryTag);
    Object.assign(el, {
      tokens: parseTokens(raw, (args.mode as "light" | "dark") ?? "light"),
    });
    return el;
  },
};

export default meta;
export const Light: StoryObj = {};
export const Dark: StoryObj = { args: { mode: "dark" } };