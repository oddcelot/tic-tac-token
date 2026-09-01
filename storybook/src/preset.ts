// Preset entry. Listing "@oddsquad/tic-tac-token-storybook" in the `addons`
// array of `.storybook/main.ts` injects the preview module that registers the
// showcase custom elements and applies the baseline parameters.
//
// Storybook v10 does not merge a `stories` glob contributed from an addon
// preset into the story index (the `stories` field must live in the
// consumer's own `.storybook/main.ts`). To keep consumers zero-story-file,
// this module also exports `tokenStoriesDirectory()`, which resolves the
// directory containing the addon's pre-built token showcase stories. Consumers
// wire a single `stories` specifier against it:
//
//   import { tokenStoriesDirectory } from "@oddsquad/tic-tac-token-storybook";
//
//   const config: StorybookConfig = {
//     framework: "@storybook/web-components-vite",
//     addons: ["@oddsquad/tic-tac-token-storybook", "@storybook/addon-docs"],
//     stories: [{ directory: tokenStoriesDirectory(), files: "*.stories.js" }],
//   };
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);

function previewDir(): string {
  return dirname(require.resolve("./preview/index.js"));
}

/** Absolute directory containing the addon's pre-built token showcase stories. */
export function tokenStoriesDirectory(): string {
  return join(previewDir(), "stories");
}

const preset = {
  previewAnnotations: [require.resolve("./preview/index.js")],
};

export default preset;