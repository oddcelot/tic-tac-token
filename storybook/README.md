# @oddsquad/tic-tac-token-storybook

Reusable Storybook addon that showcases [DTCG 2025.10](https://www.design-tokens.org/) design-token types — resolved through the [`@oddsquad/tic-tac-token`](https://github.com/oddcelot/tic-tac-token) core — as **vanilla web components**.

Every token of the requested type is rendered as its own card: colors as swatches, font sizes at their real rendered size, and so on. Token aliases are resolved, named font weights are normalized (`regular → 400`, `bold → 700`), and dark-mode variants declared in `$extensions.tic-tac-token.modes` are available via the addon's `colorScheme` toolbar global (a per-story `mode` argument is kept as a fallback).

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

The addon ships pre-built token showcase stories, so you write no `.stories.*` files
of your own. Two pieces of setup: point one `stories` specifier at the addon's bundled
stories, and hand `tokenPreviewAddon()` your resolver document.

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
// .storybook/preview.ts
import {
  externalDocumentsFrom,
  tokenPreviewAddon,
} from "@oddsquad/tic-tac-token-storybook/preview";
import resolver from "../resolver.json" with { type: "json" };

// Your document's `$ref`s are relative to the project root, so the glob's
// `../` prefix has to come off for the keys to line up.
const externalDocuments = externalDocumentsFrom(
  import.meta.glob("../tokens/**/*.json", { eager: true, import: "default" }),
);

export default {
  ...tokenPreviewAddon({ resolver, externalDocuments }),
  tags: ["autodocs"],
};
```

That is the whole setup. `tokenStoriesDirectory()` resolves the directory inside the
addon holding its compiled showcase stories — Storybook v10 does not merge a `stories`
glob contributed from an addon preset, so that specifier is the one required line in
`main.ts`. Supply no tokens at all and the showcase stories fall back to the addon's
bundled sample document.

The return value is a plain object, so it works with CSF factories too:

```ts
export default definePreview({ addons: [tokenPreviewAddon({ resolver })] });
```

### Themes & color schemes

**One toolbar dropdown per modifier, derived from the document.** Add a `density`
modifier to your resolver document and a Density dropdown appears; nothing in the addon
changes. Contexts become the items, the modifier's `default` becomes the initial value,
and the modifier name is the resolver input key.

```jsonc
// resolver.json
{
  "version": "2025.10",
  "sets": { "base": { "sources": [{ "$ref": "tokens/base.json#" }] } },
  "modifiers": {
    "theme": {
      "default": "astro",
      "contexts": {
        "astro":  [{ "$ref": "tokens/palette/astro.json#" }],
        "cosmos": [{ "$ref": "tokens/palette/cosmos.json#" }]
      }
    },
    "colorScheme": {
      "default": "light",
      "$extensions": {
        "tic-tac-token.css": { "colorScheme": true },
        "tic-tac-token.storybook": { "title": "Color scheme" }
      },
      "contexts": {
        "light": [{ "$ref": "tokens/scheme/light.json#" }],
        "dark":  [{ "$ref": "tokens/scheme/dark.json#" }]
      }
    }
  },
  "resolutionOrder": [
    { "$ref": "#/sets/base" },
    { "$ref": "#/modifiers/theme" },
    { "$ref": "#/modifiers/colorScheme" }
  ]
}
```

On every globals change the addon resolves that combination and writes the result to
`:root` as custom properties, plus one `data-*` attribute per modifier
(`data-theme="cosmos"`, `data-color-scheme="dark"`). Writing to `:root` rather than a
story wrapper is deliberate: it is how a real app consumes tokens, the properties inherit
through the shadow boundary every showcase element uses, and they also reach `<body>`
chrome and docs pages.

`colorScheme: true` marks the modifier that drives native `color-scheme`, so scrollbars
and form controls match. Absent any marker a modifier literally named `colorScheme` is
picked up by convention.

Presentational overrides live under `$extensions["tic-tac-token.storybook"]`:

| Key | Effect |
|---|---|
| `title` | Dropdown label. Defaults to a title-cased modifier name. |
| `labels` | Context name → item label. |
| `global` | Rename the toolbar global — use when `theme` would collide with another addon's. |
| `attribute` | Override the `data-*` attribute name, or `false` to skip it. |

Consumer `globalTypes` / `initialGlobals` passed to `tokenPreviewAddon()` are merged
*after* the derived ones, so you can always override.

> **Upgrading from 0.1.** The addon no longer registers a `colorScheme` toolbar global
> unconditionally. Storybook composes annotations with `Object.assign`, so a later
> annotation can override a key but cannot *remove* one — a hardcoded dropdown would be
> permanent, and inert for any document whose scheme modifier is named something else.
> Call `tokenPreviewAddon()` and the toolbar comes from your document instead.
>
> The legacy `{ raw }` and `{ documents }` parameter shapes still work, and
> `tokenPreviewAddon({ documents })` reproduces the old `theme` + `colorScheme` globals
> verbatim. `$extensions["tic-tac-token.modes"]` is ignored on the resolver path with a
> one-time console warning — see [migrating-modes-to-resolver.md](../docs/migrating-modes-to-resolver.md).

### A real component from CSS custom properties

Because the addon binds role variables on `:root`, a component needs no token code at
all — it just reads them:

```ts
class TokenCard extends HTMLElement {
  connectedCallback() {
    this.attachShadow({ mode: "open" }).innerHTML = `
      <style>
        .card {
          background: var(--color-surface);
          border-radius: var(--spacing-radius);
          padding: var(--spacing-card);
          font-family: var(--font-family-sans);
          color: var(--color-ink);
        }
      </style>
      <div class="card">…</div>`;
  }
}
```

Switching Theme or Color scheme rebinds the variables; the component never re-renders.
`examples/storybook-demo/src/token-card.ts` is exactly this.

A var's name is its token path, kebab-cased per segment (`space.itemGap` →
`--space-item-gap`), and stays stable across every context — only the value changes.
For a build-time stylesheet rather than a Storybook-injected one, core's
`resolverDocumentToCssTheme()` emits the same thing with each context scoped to its own
selector.

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
  description: "Brand, neutral, semantic and alias color tokens.",
});

export default {
  title: "Tokens/Color",
  component: show.component,
  render: show.render,
  argTypes: show.argTypes,
};

export const Default = {};
```

With no `raw`, the story renders whatever the project supplied through `tokenPreviewAddon()`,
at the contexts the toolbar currently selects — which is almost always what you want.

Two escape hatches for a story that must showcase one specific document:

- `raw` — a document (or a `(args, context) => string`) that **overrides** the project's.
- `fallbackRaw` — used only when the project supplied nothing, so it can never shadow a
  real document. This is how the addon's own bundled stories stay useful in a project with
  no setup yet.

Supported `type` values in this release: `color`, `fontFamily`, `fontWeight`, `dimension`
(used for font sizes). Other types resolve and emit CSS fine — they just have no showcase
element yet, and `tokens-gallery` skips them.

> **Why the story object is hand-assembled:** Storybook statically indexes CSF files, so `export default tokenShowcase(...)` fails with `CSF: default export must be an object`. Consumers declare a literal default export and reference the pieces `tokenShowcase()` returns.

## Export map

| Subpath             | Contents                                                    |
| ------------------- | ----------------------------------------------------------- |
| `.`                 | Addon preset (used via `addons`) + `tokenStoriesDirectory()` |
| `./preview`         | `tokenPreviewAddon()`, `externalDocumentsFrom()`, `applyTokenTheme()`, `resolveForContext()`, the toolbar derivation helpers, and element registration |
| `./components`      | The showcase custom elements (`token-color`, `tokens-gallery`, …) |
| `./tokens`          | Token parsing / CSS-formatting utilities + `PARAM_KEY` / `tokenSourceFromParameters()` |
| `./stories`         | `tokenShowcase()` helper                                    |

The addon does **not** reimplement token→CSS conversion: the value converters and
the `tokensToCssVars` role/var emitter live in the core package and are re-exported
here from `@oddsquad/tic-tac-token/css`. See [A real component from CSS custom properties](#a-real-component-from-css-custom-properties).

## Roadmap / known options

- **Zero-config consumption (implemented).** Consumers add the addon (plus one `stories` specifier) and get the full "Tokens/*" story set from pre-built showcase stories, reading the project's own document from the `ticTacToken` parameter (falling back to the addon's bundled default).
- **Resolver-Module theming (implemented).** The toolbar is derived from the document's modifiers; the selected combination is written to `:root`.
- Showcase elements still to build: `duration`, `number`, `strokeStyle`, `border`, `transition`, `cubicBezier`, `shadow`, `gradient`, `typography`. Each needs its own answer to "what does this look like as a card", which is why they are not just a wider type map.
- A `<token-diagnostics>` element. A resolver document fails in ways a raw one cannot — a bad pointer, a missing external document, an unknown context — and those currently surface as an empty grid plus a console warning.

## Try it

A working demo lives at [`examples/storybook-demo`](../examples/storybook-demo) and consumes this addon exactly as an external project would. It owns a `resolver.json` with two modifiers — `theme` (Astro / Cosmos) and `colorScheme` (light / dark) — giving two toolbar dropdowns and four combinations.

Its token files are worth a look for the layering: `tokens/palette/*.json` hold theme-specific colour ramps, while `tokens/scheme/*.json` hold nothing but semantic aliases into them and never name a theme. That works because the Resolver Module merges every source *before* it resolves any alias, and it is what lets two scheme files serve any number of themes. The **Card** story is a component with no token code at all — it reads role variables and follows the toolbar:

```sh
pnpm --filter tic-tac-token-storybook-demo dev
```