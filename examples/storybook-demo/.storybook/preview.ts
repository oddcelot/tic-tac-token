// The showcase addon renders tokens from the project's own token documents.
// Each theme owns a document (tokens/themes/*.json); the `theme` toolbar global
// picks which one drives the stories, and the `colorScheme` toolbar global picks
// the light/dark color-scheme within that theme.
import astro from "../tokens/themes/astro.json?raw";
import cosmos from "../tokens/themes/cosmos.json?raw";

// Loads the font families showcased by the token-font-family cards
// (Inter, JetBrains Mono) into the preview iframe.
import "@fontsource/inter";
import "@fontsource/jetbrains-mono";

import type { Preview } from "@storybook/web-components-vite";

const preview: Preview = {
  tags: ["autodocs"],
  initialGlobals: { theme: "astro", colorScheme: "light" },
  globalTypes: {
    theme: {
      description: "Which theme's token document to render.",
      toolbar: {
        title: "Theme",
        items: [
          { value: "astro", title: "Astro" },
          { value: "cosmos", title: "Cosmos" },
        ],
      },
    },
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
  },
  parameters: {
    controls: { expanded: true },
    ticTacToken: { documents: { astro, cosmos } },
  },
};

export default preview;