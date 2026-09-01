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

Add it to `.storybook/main.ts`. The addon's preset registers the showcase custom elements and applies baseline preview parameters:

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
| `.`                 | Addon preset (used via `addons`)                            |
| `./preview`         | Baseline preview parameters + element registration          |
| `./components`      | The showcase custom elements (`token-color`, `tokens-gallery`, …) |
| `./tokens`          | Token parsing / CSS-formatting utilities                    |
| `./stories`         | `tokenShowcase()` helper                                    |

## Roadmap / known options

- **Option B — zero-config consumption (not implemented).** An auto-injecting mode where consumers *only* add the addon and nothing else: internally, a decorator or a gallery tag (`tokens-gallery`) discovers an injected token document (via `parameters` or a preset-supplied entry) and auto-generates the per-type story sections. Adds magic; deferred while the explicit per-type `tokenShowcase()` API is validated in real projects.
- Story types still to cover: `duration`, `number`, `strokeStyle`, `border`, `transition`, `cubicBezier`, `shadow`, `gradient`, `typography`.

## Try it

A working demo lives at [`examples/storybook-demo`](../examples/storybook-demo) and consumes this addon exactly as an external project would:

```sh
pnpm --filter tic-tac-token-storybook-demo dev
```