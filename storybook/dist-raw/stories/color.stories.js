import { tokenShowcase } from "../tokenShowcase.js";
import raw from "../tokens.json?raw";

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
};

export const Default = { args: { mode: "light" } };
export const Dark = { args: { mode: "dark" } };