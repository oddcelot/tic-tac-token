import { tokenShowcase } from "@oddsquad/tic-tac-token-storybook/stories";
import type { Meta, StoryObj } from "@storybook/web-components-vite";
import raw from "../tokens/tokens.json?raw";

const show = tokenShowcase({
  type: "dimension",
  raw,
  description: "A type scale built from dimension tokens, shown at their actual size.",
});

export default {
  title: "Tokens/Font Size",
  tags: ["autodocs"],
  component: show.component,
  render: show.render,
  argTypes: show.argTypes,
  parameters: show.parameters,
} satisfies Meta;

export const Default: StoryObj = {};