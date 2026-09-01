import { defineTokenStories } from "@oddsquad/tic-tac-token-storybook/stories";
import raw from "../tokens/tokens.json?raw";

const s = defineTokenStories({
  title: "Tokens/Font Family",
  raw,
  type: "fontFamily",
  description:
    "Each font-family token rendered with its full CSS font stack. Edit the sample text to see how a specimen paragraph reads.",
});

export default s.meta;
export const Default = s.Default;