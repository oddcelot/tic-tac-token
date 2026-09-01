import { tokenShowcase } from "../tokenShowcase.js";
import { tokenDocumentFromParameters } from "../tokens.js";
import raw from "../tokens.json?raw";

const show = tokenShowcase({
  type: "fontWeight",
  raw: (args, context) => tokenDocumentFromParameters(context) ?? raw,
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
};

export const Default = {};