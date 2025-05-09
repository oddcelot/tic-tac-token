import { match, type } from "arktype";

export const NumberValue = type({ value: "number", unit: "'rem' | 'px'" });

export const Color = type({
  $type: "'color'",
  $value: {
    colorSpace:
      "'srgb' | 'srgb-linear' | 'hsl' | 'hwb' | 'lab' | 'lch' | 'oklab' | 'oklch' | 'display-p3' | 'a98-rgb' | 'prophoto-rgb' | 'rec2020' | 'xzy-d65' | 'xyz-d50'",
    components: type(["number | 'none'", "number | 'none'", "number | 'none'"]),
    alpha: "(0 <= number <= 1)?",
    hex: type("/^#[\\dA-Fa-f]+$/"),
  },
}).describe("Color");

export const Dimension = type({
  $type: "'dimension'",
  /** `px` needs to be convered to `dp` on Android and `pt` on iOS  | `1rem` on Android is eqilvalent to `16sp` */
  $value: NumberValue,
}).describe("Dimension");

export const FontFamily = type({
  $type: "'fontFamily'",
  $value: "string | string[]",
});

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
  $value: type("1 <= number <= 1000").or(FontWeightNames),
}).describe("Font Weight");

export const FontSize = type({
  $type: "'fontSize'",
  $value: "number | string",
}).describe("Font Size");

export const Duration = type({
  $type: "'duration'",
  $value: {
    value: "number.integer",
    unit: "'ms' | 's'",
  },
}).describe("Duration");

export const CubicBezier = type({
  $type: "'cubicBezier'",
  $value: type(["0 <= number <= 1", "number", "0 <= number <= 1", "number"]),
}).describe("Cubic Bezier");

export const Number = type({
  $type: "'number'",
  $value: "number",
}).describe("Number");

export const Shadow = type({
  $type: "'shadow'",
  $value: {
    color: Color,
    offsetX: NumberValue,
    offsetY: NumberValue,
    blur: NumberValue,
    spread: NumberValue,
  },
}).describe("Shadow");

export const Stroke = type({
  $type: "'stroke'",
  $value:
    "'none' | 'hidden' | 'dotted' | 'dashed' | 'solid' | 'double' | 'groove' | 'ridge' | 'inset' | 'outset'",
}).describe("Stroke");

export const StrokeStyle = type({
  $type: "'strokeStyle'",
  $value: {
    dashArray: [NumberValue, NumberValue],
    lineCap: "'round'",
  },
}).describe("Stroke Style");

export const Token = Color.or(Dimension)
  .or(FontFamily)
  .or(FontSize)
  .or(FontWeight)
  .or(Duration)
  .or(CubicBezier)
  .or(Number)
  .or(Shadow)
  .or(Stroke)
  .or(StrokeStyle);

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
  "[string]": Token,
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
