// Preset entry. Listing "@oddsquad/tic-tac-token-storybook" in the `addons`
// array of `.storybook/main.ts` injects the preview module that registers
// the showcase custom elements and applies the baseline parameters.
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const preset = {
  previewAnnotations: [require.resolve("./preview/index.js")],
};

export default preset;