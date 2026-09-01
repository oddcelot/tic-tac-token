// Runs in the Storybook preview iframe via the addon's preset.
// Importing the components module registers the custom elements, so
// consumers who simply list this package in `addons` get them all.
import "../components/index.ts";

import type { Decorator } from "@storybook/web-components-vite";

export const parameters = {
  controls: {
    matchers: {
      color: /(color|colour|background|border)$/i,
      date: /Date$/i,
    },
  },
};

// Apply the active color scheme to the preview document itself so the browser
// drives native controls (scrollbars, form fields), the default background, and
// `prefers-color-scheme`-gated OS UI to match the selected light/dark scheme —
// on top of the token variables stories derive from the `colorScheme` global.
export const decorators: Decorator[] = [
  (story, context) => {
    const scheme = context.globals?.["colorScheme"] ?? "light";
    document.documentElement.style.colorScheme = scheme;
    document.body.style.colorScheme = scheme;
    return story();
  },
];

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