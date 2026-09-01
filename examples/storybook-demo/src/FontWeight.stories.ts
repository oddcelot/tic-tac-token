import { tokenShowcase } from "@oddsquad/tic-tac-token-storybook/stories";
import type { Meta, StoryObj } from "@storybook/web-components-vite";
import raw from "../tokens/tokens.json?raw";

const show = tokenShowcase({
  type: "fontWeight",
  raw,
  description:
    "The weight ladder. Named weights (e.g. “regular”) are normalized to their numeric CSS value.",
});

export default {
  title: "Tokens/Font Weight",
  tags: ["autodocs"],
  component: show.component,
  render: show.render,
  argTypes: show.argTypes,
  parameters: show.parameters,
} satisfies Meta;

export const Default: StoryObj = {};