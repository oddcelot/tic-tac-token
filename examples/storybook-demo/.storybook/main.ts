import type { StorybookConfig } from "@storybook/web-components-vite";

// Zero-configuration demo: the storybook addon contributes everything on
// its own. Listing it in `addons` injects the showcase custom elements and
// auto-generates the whole "Tokens/*" story set from its bundled default
// token document — no `.stories.*` files or token files live in this demo.
const config: StorybookConfig = {
  framework: "@storybook/web-components-vite",
  addons: ["@oddsquad/tic-tac-token-storybook", "@storybook/addon-docs"],
};

export default config;