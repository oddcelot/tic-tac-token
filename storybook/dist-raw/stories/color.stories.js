import { tokenShowcase } from "../tokenShowcase.js";
import raw from "../tokens.json?raw";

const show = tokenShowcase({
  type: "color",
  fallbackRaw: raw,
  description:
    "Color tokens resolved through tic-tac-token. Use the toolbar to switch between the contexts the project's resolver document declares.",
});

export default {
  title: "Tokens/Color",
  tags: ["autodocs"],
  component: show.component,
  render: show.render,
  argTypes: show.argTypes,
  parameters: show.parameters,
};

export const Default = {};