import { match, type } from "arktype";
import {
  CommonMetadata,
  DimensionPrimitive,
  Extensions,
  ValueAlias,
} from "./src/tokens/shared.ts";

// Re-exported for backwards compatibility during the in-progress split.
export { CommonMetadata, Extensions, ValueAlias } from "./src/tokens/shared.ts";
export { DimensionPrimitive as NumberValue } from "./src/tokens/shared.ts";

const NumberValue = DimensionPrimitive;

export { Color, ColorValue } from "./src/tokens/color.ts";
import { Color, ColorValue } from "./src/tokens/color.ts";
export { Dimension, DimensionValue } from "./src/tokens/dimension.ts";
import { Dimension, DimensionValue } from "./src/tokens/dimension.ts";
export { FontFamily, FontFamilyValue } from "./src/tokens/fontFamily.ts";
import { FontFamily, FontFamilyValue } from "./src/tokens/fontFamily.ts";
export {
  FontWeight,
  FontWeightNames,
  FontWeightValue,
} from "./src/tokens/fontWeight.ts";
import {
  FontWeight,
  FontWeightNames,
  FontWeightValue,
} from "./src/tokens/fontWeight.ts";
export { Duration, DurationValue } from "./src/tokens/duration.ts";
import { Duration, DurationValue } from "./src/tokens/duration.ts";
export { CubicBezier, CubicBezierValue } from "./src/tokens/cubicBezier.ts";
import { CubicBezier, CubicBezierValue } from "./src/tokens/cubicBezier.ts";
export { Number, NumberLiteralValue } from "./src/tokens/number.ts";
import { Number, NumberLiteralValue } from "./src/tokens/number.ts";
export {
  StrokeStyle,
  StrokeStyleEnum,
  StrokeStyleObject,
  StrokeStyleValue,
} from "./src/tokens/strokeStyle.ts";
import {
  StrokeStyle,
  StrokeStyleValue,
} from "./src/tokens/strokeStyle.ts";
export { Shadow, SingleShadow } from "./src/tokens/shadow.ts";
import { Shadow } from "./src/tokens/shadow.ts";
export { Border } from "./src/tokens/border.ts";
import { Border } from "./src/tokens/border.ts";
export { Transition } from "./src/tokens/transition.ts";
import { Transition } from "./src/tokens/transition.ts";
export { Gradient, GradientStop } from "./src/tokens/gradient.ts";
import { Gradient } from "./src/tokens/gradient.ts";
export { Typography } from "./src/tokens/typography.ts";
import { Typography } from "./src/tokens/typography.ts";


export const Token = Color.or(Dimension)
  .or(FontFamily)
  .or(FontWeight)
  .or(Duration)
  .or(CubicBezier)
  .or(Number)
  .or(Shadow)
  .or(StrokeStyle)
  .or(Border)
  .or(Transition)
  .or(Gradient)
  .or(Typography)
  .and(CommonMetadata);

// export const Schema = type({
//   "[string]": Token,
//   "thing": "string"
// });

export const Schema = match({
  string: (v) => Token,

  default: "assert",
});

export const Schema2 = type({
  "[symbol]": "string",
  "[string]": Token.or(type({ "[string]": Token })),
});

type Token = typeof Token.infer;

export const exampleToken: Token = {
  $type: "fontWeight",
  $value: 123,
};

export const exampleToken2: Token = {
  $type: "fontWeight",
  $value: "light",
};
