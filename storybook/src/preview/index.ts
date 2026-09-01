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

// The `colorScheme` toolbar global is registered here so any project using the
// addon gets a light/dark switcher without manual setup; the showcase stories
// read it to pick the active mode. Consumers can override `initialGlobals`/the
// items in their own preview.
export const globalTypes = {
  colorScheme: {
    description: "Light or dark color scheme within the active theme.",
    toolbar: {
      title: "Color scheme",
      items: [
        { value: "light", title: "Light" },
        { value: "dark", title: "Dark" },
      ],
    },
  },
};

export const initialGlobals = { colorScheme: "light" };