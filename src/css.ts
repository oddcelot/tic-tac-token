// Pure, framework-free derivation of CSS custom properties from resolved
// design tokens. The input is the concrete flat token list produced by the
// resolver (aliases already dereferenced), so each token maps to CSS with no
// further resolution here.
//
// Implementation lives in `./css/`; this module is the public surface behind
// the `@oddsquad/tic-tac-token/css` subpath.
export {
  basePath,
  cssVarSegments,
  isEmittablePath,
  kebabCase,
  pathToCssVar,
  subPropertyVar,
} from "./css/names.ts";

export {
  borderToCss,
  colorToCss,
  cubicBezierToCss,
  dimensionToCss,
  durationToCss,
  fontFamilyToCss,
  fontWeightToCss,
  gradientToCss,
  numberToCss,
  shadowToCss,
  strokeStyleToCss,
  toCssValue,
  tokenToCssDeclarations,
  transitionToCss,
} from "./css/values.ts";
export type { CssDeclaration, CssValueOptions } from "./css/values.ts";

export { tokensToCssVars } from "./css/sheet.ts";
export type { CssVarBundle, CssVarOptions } from "./css/sheet.ts";
