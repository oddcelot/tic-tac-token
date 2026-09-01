import { defineTokenStories } from "@oddsquad/tic-tac-token-storybook/stories";
import raw from "../tokens/tokens.json?raw";

const s = defineTokenStories({
  title: "Tokens/Color",
  raw,
  type: "color",
  description:
    "Color tokens resolved through tic-tac-token. Toggle the mode argument to swap to the dark mode variants declared in `$extensions.tic-tac-token.modes`.",
});

export default s.meta;
export const Default = s.Default;
export const Dark = s.Dark!;