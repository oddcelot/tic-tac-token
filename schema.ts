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

export const FontWeightAliasMap = type({
  100: "'thin' | 'hairline'",
  200: "'extra-light' | 'ultra-light'",
  300: "'light'",
  400: "'normal' | 'regular' | 'book'",
  500: "'medium'",
  600: "'semi-bold' | 'demi-bold'",
  700: "'bold'",
  800: "'extra-bold' | 'ultra-bold'",
  900: "'black' | 'heavy'",
  950: "'extra-black' | 'ultra-black'",
});

// const ResolvedFontWeightAlias = type.enumerated(
//   ...Object.values(
//     FontWeightAliasMap.pipe((weights) => weights).to("string")
//       .inferIntrospectableOut || FontWeightNames
//   )
// );

const FontWeightNames = type.enumerated(
  "thin",
  "hairline",
  "extra-light",
  "ultra-light",
  "light",
  "normal",
  "regular",
  "book",
  "medium",
  "semi-bold",
  "demi-bold",
  "bold",
  "extra-bold",
  "ultra-bold",
  "black",
  "heavy",
  "extra-black",
  "ultra-black"
);

/** some weight */
export const FontWeight = type({
  $type: "'fontWeight'",
  $value: ValueAlias.or(type("1 <= number <= 1000").or(FontWeightNames)),
}).describe("Font Weight");

export const Duration = type({
  $type: "'duration'",
  $value: ValueAlias.or({
    value: "number",
    unit: "'ms' | 's'",
  }),
}).describe("Duration");

export const CubicBezier = type({
  $type: "'cubicBezier'",
  $value: ValueAlias.or(
    type(["0 <= number <= 1", "number", "0 <= number <= 1", "number"])
  ),
}).describe("Cubic Bezier");

export const Number = type({
  $type: "'number'",
  $value: ValueAlias.or("number"),
}).describe("Number");

const SingleShadow = type({
  color: Color,
  offsetX: NumberValue,
  offsetY: NumberValue,
  blur: NumberValue,
  spread: NumberValue,
  "inset?": "boolean",
}).onUndeclaredKey("reject");

export const Shadow = type({
  $type: "'shadow'",
  $value: ValueAlias.or(SingleShadow).or(SingleShadow.array()),
}).describe("Shadow");

const StrokeStyleEnum = type(
  "'solid' | 'dashed' | 'dotted' | 'double' | 'groove' | 'ridge' | 'outset' | 'inset'"
);

const StrokeStyleObject = type({
  dashArray: NumberValue.array(),
  lineCap: "'round' | 'butt' | 'square'",
}).onUndeclaredKey("reject");

export const StrokeStyle = type({
  $type: "'strokeStyle'",
  $value: ValueAlias.or(StrokeStyleEnum).or(StrokeStyleObject),
}).describe("Stroke Style");

const FontWeightValue = ValueAlias.or(
  type("1 <= number <= 1000").or(FontWeightNames)
);
const NumberLiteralValue = ValueAlias.or("number");

const StrokeStyleValue = ValueAlias.or(StrokeStyleEnum).or(StrokeStyleObject);

const GradientStop = type({
  color: ColorValue,
  position: ValueAlias.or("number"),
}).onUndeclaredKey("reject");

export const Gradient = type({
  $type: "'gradient'",
  $value: ValueAlias.or(GradientStop.array()),
}).describe("Gradient");

const DurationValue = ValueAlias.or(
  type({ value: "number", unit: "'ms' | 's'" })
);

const CubicBezierValue = ValueAlias.or(
  type(["0 <= number <= 1", "number", "0 <= number <= 1", "number"])
);

export const Transition = type({
  $type: "'transition'",
  $value: ValueAlias.or({
    duration: DurationValue,
    delay: DurationValue,
    timingFunction: CubicBezierValue,
  }),
}).describe("Transition");

export const Border = type({
  $type: "'border'",
  $value: ValueAlias.or({
    color: ColorValue,
    width: DimensionValue,
    style: StrokeStyleValue,
  }),
}).describe("Border");

export const Typography = type({
  $type: "'typography'",
  $value: ValueAlias.or({
    fontFamily: FontFamilyValue,
    fontSize: DimensionValue,
    fontWeight: FontWeightValue,
    letterSpacing: DimensionValue,
    lineHeight: NumberLiteralValue,
  }),
}).describe("Typography");

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
