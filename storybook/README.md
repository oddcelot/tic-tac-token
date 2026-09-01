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
files (or token files) of your own. Add the addon and point a single `stories`
specifier at the addon's bundled stories:

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

`tokenStoriesDirectory()` (exported from the package root) resolves the directory
inside the addon that contains its compiled showcase stories. The built-in default
token document drives the whole "Tokens/*" set — Color, Font Family, Font Size,
Font Weight and an Overview. Storybook v10 does not merge a `stories` glob contributed
from an addon preset, so this single specifier is the one required line.

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
| `./tokens`          | Token parsing / CSS-formatting utilities                    |
| `./stories`         | `tokenShowcase()` helper                                    |

## Roadmap / known options

- **Option B — zero-config consumption (implemented).** Consumers only add the addon (plus one `stories` specifier) and get the full "Tokens/*" story set from pre-built showcase stories bundled in the addon's dist. See [Zero-config setup](#zero-config-recommended) above.
- Story types still to cover: `duration`, `number`, `strokeStyle`, `border`, `transition`, `cubicBezier`, `shadow`, `gradient`, `typography`.

## Try it

A working demo lives at [`examples/storybook-demo`](../examples/storybook-demo) and consumes this addon exactly as an external project would:

```sh
pnpm --filter tic-tac-token-storybook-demo dev
```