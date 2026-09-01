import { tokenShowcase } from "../tokenShowcase.js";
import raw from "../tokens.json?raw";

const show = tokenShowcase({
  type: "fontFamily",
  fallbackRaw: raw,
  description:
    "Each font-family token rendered with its full CSS font stack. Edit the sample text to see how a specimen paragraph reads.",
});

export default {
  title: "Tokens/Font Family",
  tags: ["autodocs"],
  component: show.component,
  render: show.render,
  argTypes: show.argTypes,
  parameters: show.parameters,
};

export const Default = {};