# examples/simple

A minimal external-consumer demo for [`@oddsquad/tic-tac-token`](../../README.md). Installs the package like any npm consumer would (not via this repo's pnpm workspace) and runs a small script that validates and resolves a DTCG tokens file.

## Run it (once the package is published)

```sh
cd examples/simple
npm install
npm start
```

## Run it locally, before publish

From the repo root:

```sh
pnpm build:dist
npm pack --pack-destination examples/simple
cd examples/simple
npm install ./oddsquad-tic-tac-token-*.tgz --no-save
npm start
rm oddsquad-tic-tac-token-*.tgz
```

`--no-save` installs from the exact tarball `npm publish` would ship (proving the `files` allowlist and `exports` map both work for a real consumer) without overwriting the `^0.1.0` dependency range committed in `package.json`.

## What it shows

- `color.brand-hover` has no `$type` of its own — it inherits `color` from the parent group.
- `color.brand-hover`'s value is the alias `"{color.brand}"`, resolved to the same value as `color.brand`.
- `gradient.hero`'s stop positions (`-0.2`, `1.4`) are out of range; the resolver clamps them to `0` and `1`.
