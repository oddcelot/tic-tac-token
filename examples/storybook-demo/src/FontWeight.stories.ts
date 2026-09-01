import { defineTokenStories } from "@oddsquad/tic-tac-token-storybook/stories";
import raw from "../tokens/tokens.json?raw";

const s = defineTokenStories({
  title: "Tokens/Font Weight",
  raw,
  type: "fontWeight",
  description:
    "The weight ladder. Named weights (e.g. “regular”) are normalized to their numeric CSS value.",
});

export default s.meta;
export const Default = s.Default;