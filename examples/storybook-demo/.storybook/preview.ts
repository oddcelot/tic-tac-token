// The showcase addon renders tokens from the project's own token document.
// It's supplied here as a global parameter; the addon's auto-injected stories
// read it (falling back to the addon's bundled default when it's absent).
import raw from "../tokens/tokens.json?raw";

// Loads the font families showcased by the token-font-family cards
// (Inter, JetBrains Mono) into the preview iframe.
import "@fontsource/inter";
import "@fontsource/jetbrains-mono";

import type { Preview } from "@storybook/web-components-vite";

const preview: Preview = {
  tags: ["autodocs"],
  parameters: {
    controls: { expanded: true },
    ticTacToken: { raw },
  },
};

export default preview;