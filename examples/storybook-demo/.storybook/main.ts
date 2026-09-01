import type { StorybookConfig } from "@storybook/web-components-vite";

// Stitches the reusable token-showcase addon into this demo. The `addons`
// entry runs the addon's preset, which registers the showcase custom
// elements and applies the baseline preview parameters.
const config: StorybookConfig = {
  framework: "@storybook/web-components-vite",
  stories: ["../src/**/*.stories.ts"],
  addons: ["@oddsquad/tic-tac-token-storybook"],
};

export default config;