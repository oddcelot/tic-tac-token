import type { StorybookConfig } from "@storybook/web-components-vite";
import { tokenStoriesDirectory } from "@oddsquad/tic-tac-token-storybook";

// The addon contributes the token showcase custom elements and pre-built
// "Tokens/*" stories (zero-config). The demo also owns its own example stories
// under src/ — here a sample component that consumes the core
// tokensToCssVars() API exactly as the demo's own app would. Storybook v10
// requires the `stories` globs to live in this file.
const config: StorybookConfig = {
  framework: "@storybook/web-components-vite",
  addons: ["@oddsquad/tic-tac-token-storybook", "@storybook/addon-docs"],
  stories: [
    { directory: tokenStoriesDirectory(), files: "*.stories.js" },
    "../src/**/*.stories.ts",
  ],
};

export default config;