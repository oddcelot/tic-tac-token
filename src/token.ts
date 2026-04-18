import { type } from "arktype";
import { Border } from "./tokens/border.ts";
import { Color } from "./tokens/color.ts";
import { CubicBezier } from "./tokens/cubicBezier.ts";
import { Dimension } from "./tokens/dimension.ts";
import { Duration } from "./tokens/duration.ts";
import { FontFamily } from "./tokens/fontFamily.ts";
import { FontWeight } from "./tokens/fontWeight.ts";
import { Gradient } from "./tokens/gradient.ts";
import { Number } from "./tokens/number.ts";
import { CommonMetadata } from "./tokens/shared.ts";
import { Shadow } from "./tokens/shadow.ts";
import { StrokeStyle } from "./tokens/strokeStyle.ts";
import { Transition } from "./tokens/transition.ts";
import { Typography } from "./tokens/typography.ts";

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
  .and(CommonMetadata)
  .onUndeclaredKey("reject");

export const TokensFile = type({
  "[string]": Token.or(type({ "[string]": Token })),
});
