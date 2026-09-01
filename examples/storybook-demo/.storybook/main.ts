import type { StorybookConfig } from "@storybook/web-components-vite";
import { tokenStoriesDirectory } from "@oddsquad/tic-tac-token-storybook";

// Zero-configuration demo: the addon contributes the showcase custom
// elements and the pre-built token showcase stories. Storybook v10 requires
// the `stories` glob to live in this file, so we point a single specifier at
// the addon's bundled `*.stories.js` — no per-token story files live here.
const config: StorybookConfig = {
  framework: "@storybook/web-components-vite",
  addons: ["@oddsquad/tic-tac-token-storybook", "@storybook/addon-docs"],
  stories: [{ directory: tokenStoriesDirectory(), files: "*.stories.js" }],
};

export default config;