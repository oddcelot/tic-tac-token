import { defineTokenStories } from "@oddsquad/tic-tac-token-storybook/stories";
import raw from "../tokens/tokens.json?raw";

const s = defineTokenStories({
  title: "Tokens/Font Size",
  raw,
  type: "dimension",
  description:
    "A type scale built from dimension tokens, shown at their actual size.",
});

export default s.meta;
export const Default = s.Default;