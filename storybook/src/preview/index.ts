// Runs in the Storybook preview iframe via the addon's preset.
// Importing the components module registers the custom elements, so
// consumers who simply list this package in `addons` get them all.
import "../components/index.ts";

export const parameters = {
  controls: {
    matchers: {
      color: /(color|colour|background|border)$/i,
      date: /Date$/i,
    },
  },
};