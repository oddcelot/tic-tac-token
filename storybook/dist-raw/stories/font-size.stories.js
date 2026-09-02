import { tokenShowcase } from "../tokenShowcase.js";
import raw from "../tokens.json?raw";

const show = tokenShowcase({
  type: "dimension",
  fallbackRaw: raw,
  description: "A type scale built from dimension tokens, shown at their actual size.",
});

export default {
  title: "Tokens/Font Size",
  tags: ["autodocs"],
  component: show.component,
  render: show.render,
  argTypes: show.argTypes,
  parameters: show.parameters,
};

export const Default = {};