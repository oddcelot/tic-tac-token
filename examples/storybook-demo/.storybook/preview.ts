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

import type { Preview, Decorator } from "@storybook/web-components-vite";
import { resolveTokens } from "@oddsquad/tic-tac-token/resolver";

const DOCS: Record<string, string> = { astro, cosmos };

// Paint the whole story with the active theme's `color.background` token,
// resolved at the current color scheme — so a dark theme's base surface (not a
// fixed white) fills the preview behind every story.
const themeBackground: Decorator = (story, context) => {
  const scheme = context.globals?.colorScheme ?? "light";
  const raw = DOCS[context.globals?.theme as string] ?? astro;
  try {
    const { tokens } = resolveTokens(JSON.parse(raw));
    const bg = tokens.find(
      (t) => t.path === (scheme === "dark" ? "color.background@dark" : "color.background"),
    );
    const hex = bg?.$value && typeof bg.$value === "object"
      ? (bg.$value as { hex?: string }).hex
      : undefined;
    document.body.style.background = hex ? (hex.startsWith("#") ? hex : `#${hex}`) : "";
  } catch {
    document.body.style.background = "";
  }
  return story();
};

const preview: Preview = {
  tags: ["autodocs"],
  decorators: [themeBackground],
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