// The addon derives everything from the resolver document: one toolbar
// dropdown per modifier, and a decorator that writes the selected combination
// to `:root` as custom properties plus `data-*` attributes.
//
// `globalTypes` has to be a static export of a preview annotation, and this
// file is one — which is why the toolbar is built here rather than in the
// preset.
import {
  externalDocumentsFrom,
  tokenPreviewAddon,
} from "@oddsquad/tic-tac-token-storybook/preview";
import resolver from "../resolver.json" with { type: "json" };

// Loads the font families showcased by the token-font-family cards
// (Inter, JetBrains Mono) into the preview iframe.
import "@fontsource/inter";
import "@fontsource/jetbrains-mono";

import type { Preview } from "@storybook/web-components-vite";

// The resolver document's `$ref`s are written relative to the project root
// (`tokens/base.json`), so the glob's `../` prefix has to come off for the
// keys to line up.
const externalDocuments = externalDocumentsFrom(
  import.meta.glob("../tokens/**/*.json", { eager: true, import: "default" }),
);

const addon = tokenPreviewAddon({ resolver, externalDocuments });

const preview: Preview = {
  ...addon,
  tags: ["autodocs"],
  // Spreading `addon` and then writing `parameters` would replace the addon's
  // own parameters wholesale — plain object-literal overwrite. Merge instead.
  parameters: { ...addon.parameters, controls: { expanded: true } },
};

export default preview;
