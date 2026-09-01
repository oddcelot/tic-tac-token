import { tokenShowcase } from "@oddsquad/tic-tac-token-storybook/stories";
import type { Meta, StoryObj } from "@storybook/web-components-vite";
import raw from "../tokens/tokens.json?raw";

const show = tokenShowcase({
  type: "color",
  raw,
  description:
    "Color tokens resolved through tic-tac-token. Toggle the mode argument to swap to the dark mode variants declared in `$extensions.tic-tac-token.modes`.",
});

export default {
  title: "Tokens/Color",
  tags: ["autodocs"],
  component: show.component,
  render: show.render,
  args: show.args,
  argTypes: show.argTypes,
  parameters: show.parameters,
} satisfies Meta;

export const Default: StoryObj = { args: { mode: "light" } };
export const Dark: StoryObj = { args: { mode: "dark" } };