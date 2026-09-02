// Runs in the Storybook preview iframe via the addon's preset.
// Importing the components module registers the custom elements, so
// consumers who simply list this package in `addons` get them all.
import "../components/index.ts";

import type { Decorator } from "@storybook/web-components-vite";
import { applyTokenTheme } from "./applyTheme.ts";

export { tokenPreviewAddon, externalDocumentsFrom } from "./definePreview.ts";
export type {
  TokenPreviewOptions,
  TokenPreviewAnnotations,
} from "./definePreview.ts";
export { applyTokenTheme, STYLE_MARKER } from "./applyTheme.ts";
export type { ApplyOptions } from "./applyTheme.ts";
export { resolveForContext } from "./resolve.ts";
export type { TokenResolution } from "./resolve.ts";
export {
  STORYBOOK_EXT,
  attributeFor,
  colorSchemeModifier,
  globalNameFor,
  initialContextFor,
  inputsFromGlobals,
  titleCase,
  tokenGlobalTypes,
  tokenInitialGlobals,
} from "./resolverConfig.ts";
export type { StorybookModifierExt, ToolbarArgType } from "./resolverConfig.ts";

export const parameters = {
  controls: {
    matchers: {
      color: /(color|colour|background|border)$/i,
      date: /Date$/i,
    },
  },
};

// Resolve and apply whatever tokens the project supplied, at whatever contexts
// the toolbar currently selects. Without a `tokenPreviewAddon()` call in the
// consumer's own preview.ts there is no toolbar, and every modifier resolves
// at its declared default — so stories still render correctly, they just can't
// be switched.
export const decorators: Decorator[] = [
  (story, context) => {
    applyTokenTheme(context as never);
    return story();
  },
];

// No `globalTypes` here on purpose.
//
// Storybook composes annotations with `Object.assign` over a filtered list, so
// a later annotation can override a key but cannot *remove* one. A hardcoded
// `colorScheme` dropdown would therefore be permanent — and inert for any
// document whose scheme modifier is named something else. The toolbar is
// derived instead, from the document, by `tokenPreviewAddon()`.
