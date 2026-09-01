// Preset entry. Listing "@oddsquad/tic-tac-token-storybook" in the `addons`
// array of `.storybook/main.ts` is all a consumer needs. The preset:
//
//  1. injects the preview module that registers the showcase custom
//     elements and applies the baseline parameters, and
//  2. contributes a `stories` glob pointing at the pre-built token
//     showcase stories shipped in the addon's dist, so consumers get the
//     full story set without writing any `.stories.*` files of their own.
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);

const previewDir = dirname(require.resolve("./preview/index.js"));

const preset = {
  previewAnnotations: [require.resolve("./preview/index.js")],
  stories: [
    {
      directory: join(previewDir, "stories"),
      files: "*.stories.js",
    },
  ],
};

export default preset;