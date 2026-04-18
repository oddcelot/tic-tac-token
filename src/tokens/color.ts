import { type } from "arktype";
import { ValueAlias } from "./shared.ts";

// Component type helpers, mirroring the named component types in
// DTCG 2025.10 format/values/color.json (zeroToOneComponent,
// percentageComponent, hueComponent, chromaComponent, unboundedComponent).
// Every component may also be the literal string "none" to indicate an
// unresolved/undefined channel (semantically distinct from 0 during
// interpolation).
const zeroOneComponent = "(0 <= number <= 1) | 'none'";
const percentComponent = "(0 <= number <= 100) | 'none'";
const hueComponent = "(0 <= number < 360) | 'none'";
const chromaComponent = "(number >= 0) | 'none'";
const unboundedComponent = "number | 'none'";

const rgbComponents = type([
  zeroOneComponent,
  zeroOneComponent,
  zeroOneComponent,
]);
const xyzComponents = rgbComponents;
const hslOrHwbComponents = type([
  hueComponent,
  percentComponent,
  percentComponent,
]);
const labComponents = type([
  percentComponent,
  unboundedComponent,
  unboundedComponent,
]);
const lchComponents = type([percentComponent, chromaComponent, hueComponent]);
const oklabComponents = type([
  zeroOneComponent,
  unboundedComponent,
  unboundedComponent,
]);
const oklchComponents = type([zeroOneComponent, chromaComponent, hueComponent]);

// Optional fields shared by every color-space variant. Spread into each
// branch below so the discriminated union can key on colorSpace cleanly.
const colorCommon = {
  "alpha?": "0 <= number <= 1",
  "hex?": type("/^#[\\dA-Fa-f]{6}$/"),
} as const;

const rgbColor = type({
  colorSpace:
    "'srgb' | 'srgb-linear' | 'display-p3' | 'a98-rgb' | 'prophoto-rgb' | 'rec2020'",
  components: rgbComponents,
  ...colorCommon,
}).onUndeclaredKey("reject");

const xyzColor = type({
  colorSpace: "'xyz-d65' | 'xyz-d50'",
  components: xyzComponents,
  ...colorCommon,
}).onUndeclaredKey("reject");

const hslColor = type({
  colorSpace: "'hsl'",
  components: hslOrHwbComponents,
  ...colorCommon,
}).onUndeclaredKey("reject");

const hwbColor = type({
  colorSpace: "'hwb'",
  components: hslOrHwbComponents,
  ...colorCommon,
}).onUndeclaredKey("reject");

const labColor = type({
  colorSpace: "'lab'",
  components: labComponents,
  ...colorCommon,
}).onUndeclaredKey("reject");

const lchColor = type({
  colorSpace: "'lch'",
  components: lchComponents,
  ...colorCommon,
}).onUndeclaredKey("reject");

const oklabColor = type({
  colorSpace: "'oklab'",
  components: oklabComponents,
  ...colorCommon,
}).onUndeclaredKey("reject");

const oklchColor = type({
  colorSpace: "'oklch'",
  components: oklchComponents,
  ...colorCommon,
}).onUndeclaredKey("reject");

export const ColorValue = ValueAlias.or(rgbColor)
  .or(xyzColor)
  .or(hslColor)
  .or(hwbColor)
  .or(labColor)
  .or(lchColor)
  .or(oklabColor)
  .or(oklchColor);

export const Color = type({
  $type: "'color'",
  $value: ColorValue,
}).describe("Color");
