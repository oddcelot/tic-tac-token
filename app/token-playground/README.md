## Usage

Those templates dependencies are maintained via [pnpm](https://pnpm.io) via `pnpm up -Lri`.

This is the reason you see a `pnpm-lock.yaml`. That being said, any package manager will work. This file can be safely be removed once you clone a template.

```bash
$ npm install # or pnpm install or yarn install
```

### Learn more on the [Solid Website](https://solidjs.com) and come chat with us on our [Discord](https://discord.com/invite/solidjs)

## Available Scripts

In the project directory, you can run:

### `npm run dev` or `npm start`

Runs the app in the development mode.<br>
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.<br>

### `npm run build`

Builds the app for production to the `dist` folder.<br>
It correctly bundles Solid in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.<br>
Your app is ready to be deployed!

## Deployment

You can deploy the `dist` folder to any static host provider (netlify, surge, now, etc.)

## Schema validation in the editor

The Monaco editor validates the document on the left against two JSON schemas:

- **`/schema.json`** — the schema emitted from this repo's arktype Token
  type by `pnpm generate-schema` at the repo root. Served by the Vite
  dev server (and emitted as a static build asset) from the repo-root
  `schema.json` via the `rootSchemaPlugin` in `vite.config.ts`. This is
  the default schema applied to every JSON file in the editor (`fileMatch: ["*"]`).
  Grades the document against **this repo's implementation**.

- **`https://www.designtokens.org/schemas/2025.10/format.json`** — the
  canonical Design Tokens Community Group format schema. Registered by
  URI only, with no inlined content, so Monaco fetches it when a
  document declares `"$schema": "https://www.designtokens.org/schemas/2025.10/format.json"`.
  Grades the document against **the upstream DTCG spec** — which is
  stricter than ours in a few places (see `docs/dtcg-spec.md`).

To switch the editor from repo-schema grading to DTCG-canonical grading,
change the `$schema` line at the top of the document in the editor. Both
registrations live in `src/App.tsx`.

## This project was created with the [Solid CLI](https://github.com/solidjs-community/solid-cli)
