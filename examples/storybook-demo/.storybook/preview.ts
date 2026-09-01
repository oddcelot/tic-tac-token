// Loads the font families showcased by the token-font-family cards
// (Inter, JetBrains Mono) into the preview iframe.
import "@fontsource/inter";
import "@fontsource/jetbrains-mono";

import type { Preview } from "@storybook/web-components-vite";

const preview: Preview = {
  tags: ["autodocs"],
  parameters: {
    controls: { expanded: true },
  },
};

export default preview;