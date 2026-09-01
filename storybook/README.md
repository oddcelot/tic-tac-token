# @oddsquad/tic-tac-token-storybook

Reusable Storybook addon that showcases [DTCG 2025.10](https://www.design-tokens.org/) design-token types — resolved through the [`@oddsquad/tic-tac-token`](https://github.com/oddcelot/tic-tac-token) core — as **vanilla web components**.

Every token of the requested type is rendered as its own card: colors as swatches, font sizes at their real rendered size, and so on. Token aliases are resolved, named font weights are normalized (`regular → 400`, `bold → 700`), and dark-mode variants declared in `$extensions.tic-tac-token.modes` are available via a `mode` story argument.

## Requirements

- Node >= 26, pnpm
- Storybook >= 10, installed with the `@storybook/web-components-vite` framework

## Install

```sh
pnpm add @oddsquad/tic-tac-token-storybook
```

## Setup

Two ways to consume the addon.

### Zero-config (recommended)

The addon ships pre-built token showcase stories, so you don't write any `.stories.*`
files of your own — you only point one `stories` specifier at the addon's bundled
stories and drop your token document(s) into the addon via a global parameter:

```ts
// .storybook/main.ts
import { tokenStoriesDirectory } from "@oddsquad/tic-tac-token-storybook";

export default {
  framework: "@storybook/web-components-vite",
  addons: [
    "@oddsquad/tic-tac-token-storybook",
    "@storybook/addon-docs", // for the autodocs pages
  ],
  stories: [{ directory: tokenStoriesDirectory(), files: "*.stories.js" }],
};
```

```ts
// .storybook/preview.ts — the project owns its token document(s)
import raw from "../tokens/tokens.json?raw";

export default {
  parameters: { ticTacToken: { raw } },
};
```

`tokenStoriesDirectory()` (exported from the package root) resolves the directory
inside the addon that contains its compiled showcase stories. The `tokens/tokens.json`
file is **yours** — the addon's Color, Font Family, Font Size, Font Weight and Overview
stories read it from the `ticTacToken` parameter. Storybook v10 does not merge a `stories`
glob contributed from an addon preset, so the single specifier is the one required line
in `main.ts`. If you don't supply a token document, the addon falls back to its bundled
default sample.

### Themes & color schemes

Supply multiple token documents keyed by **theme** and a `theme` toolbar global to
switch between them. Each theme's document keeps its own `$extensions.tic-tac-token.modes`
light/dark **color-scheme** variants, driven by the `colorScheme` toolbar global — which
the addon registers in its baseline preview (so you don't have to declare it yourself) and
sets to `light` by default:

```ts
// .storybook/preview.ts
import astro from "../tokens/themes/astro.json?raw";
import cosmos from "../tokens/themes/cosmos.json?raw";

export default {
  initialGlobals: { theme: "astro" },
  globalTypes: {
    theme: {
      toolbar: {
        title: "Theme",
        items: [
          { value: "astro", title: "Astro" },
          { value: "cosmos", title: "Cosmos" },
        ],
      },
    },
  },
  parameters: { ticTacToken: { documents: { astro, cosmos } } },
};
```

The addon reads `context.globals.theme` and renders that theme's document (the first
one is used when the current theme is unknown) at the scheme picked by the `colorScheme`
global — yielding the full **theme × color-scheme** matrix from the two toolbar dropdowns.
Callers can override `initialGlobals.colorScheme` or the toolbar's items in their own
preview. A per-story `mode` argument is still honored as a fallback for consumers who
prefer not to use the global.

### A real component from CSS custom properties

The addon's value-to-CSS conversion is pure core API (`@oddsquad/tic-tac-token/css`):
`tokensToCssVars()` turns a resolved token list into a CSS custom-property bundle.
Any app — or any Storybook project — can consume it directly to build real components
from tokens:

```ts
import { resolveTokens } from "@oddsquad/tic-tac-token/resolver";
import { tokensToCssVars } from "@oddsquad/tic-tac-token/css";

const { tokens } = resolveTokens(myThemeDoc);
const css = tokensToCssVars(tokens); // { css, roles, for() }
css.for("color.primary", "spacing.card"); // { "--color-primary": "#0D998C", "--spacing-card": "16px" }
```

- Declaring a role token (`color.primary = {color.blue}`) yields `--color-primary`
  whose value changes per theme, while the var name stays constant — so the same
  markup follows the active theme **×** scheme with no code changes.
- `tokensToCssVars` emits one var per resolved token, named by full path
  (`color.primary` → `--color-primary`); mode-variant tokens (`color.primary@dark`)
  map to the same var so a role name is stable across color schemes. `css` is the
  full sheet, `roles` indexes stable names → value, and `for(...)` returns exactly
  the roles a component needs.

The demo (`examples/storybook-demo`) includes a worked example: its **Card** story
(`src/token-card.ts`) is a component authored in the demo itself that uses
`resolveTokens()` + `tokensToCssVars()` and styles itself only from stable role vars —
following the theme switcher and light/dark scheme, with no addon involvement in the
component's token logic.

### Bring-your-own tokens

Only add the addon and write your own thin story files as usual:

```ts
// .storybook/main.ts
export default {
  framework: "@storybook/web-components-vite",
  stories: ["../src/**/*.stories.ts"],
  addons: ["@oddsquad/tic-tac-token-storybook"],
};
```

## Writing stories

Story values are produced by the `tokenShowcase()` helper, exported from `@oddsquad/tic-tac-token-storybook/stories`:

```ts
// src/Color.stories.ts
import { tokenShowcase } from "@oddsquad/tic-tac-token-storybook/stories";
import raw from "../tokens/tokens.json?raw";

const show = tokenShowcase({
  type: "color",
  raw,
  description: "Brand, neutral, semantic and alias color tokens.",
});

export default {
  title: "Tokens/Color",
  component: show.component,
  render: show.render,
  args: show.args,
  argTypes: show.argTypes,
};

export const Dark = { args: { mode: "dark" } };
```

Supported `type` values in this release: `color`, `fontFamily`, `fontWeight`, `dimension` (used for font sizes).

> **Why the story object is hand-assembled:** Storybook statically indexes CSF files, so `export default tokenShowcase(...)` fails with `CSF: default export must be an object`. Consumers declare a literal default export and reference the pieces `tokenShowcase()` returns.

## Export map

| Subpath             | Contents                                                    |
| ------------------- | ----------------------------------------------------------- |
| `.`                 | Addon preset (used via `addons`) + `tokenStoriesDirectory()` |
| `./preview`         | Baseline preview parameters + element registration          |
| `./components`      | The showcase custom elements (`token-color`, `tokens-gallery`, …) |
| `./tokens`          | Token parsing / CSS-formatting utilities + `PARAM_KEY` / `tokenDocumentFromParameters()` |
| `./stories`         | `tokenShowcase()` helper                                    |

The addon does **not** reimplement token→CSS conversion: the value converters and
the `tokensToCssVars` role/var emitter live in the core package and are re-exported
here from `@oddsquad/tic-tac-token/css`. See [A real component from CSS custom properties](#a-real-component-from-css-custom-properties).

## Roadmap / known options

- **Option B — zero-config consumption (implemented).** Consumers add the addon (plus one `stories` specifier) and get the full "Tokens/*" story set from pre-built showcase stories, reading the project's own token document(s) from the `ticTacToken` parameter (falling back to the addon's bundled default). See [Zero-config setup](#zero-config-recommended) above.
- Story types still to cover: `duration`, `number`, `strokeStyle`, `border`, `transition`, `cubicBezier`, `shadow`, `gradient`, `typography`.

## Try it

A working demo lives at [`examples/storybook-demo`](../examples/storybook-demo) and consumes this addon exactly as an external project would — it owns `tokens/themes/*.json` (an Astro and a Cosmos theme, each with light/dark schemes), switches them via the toolbar `Theme` global, and feeds them to the addon through the `ticTacToken` parameter. It also shows a **Card** example component authored in the demo that uses the core token→CSS API directly:

```sh
pnpm --filter tic-tac-token-storybook-demo dev
```