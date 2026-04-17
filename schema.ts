import { match, type } from "arktype";

export const NumberValue = type({ value: "number", unit: "'rem' | 'px'" });
const ValueAlias = type("/^{([^{}]+?)}$/");

export const Color = type({
  $type: "'color'",
  $value: ValueAlias.or({
    colorSpace:
      "'srgb' | 'srgb-linear' | 'hsl' | 'hwb' | 'lab' | 'lch' | 'oklab' | 'oklch' | 'display-p3' | 'a98-rgb' | 'prophoto-rgb' | 'rec2020' | 'xyz-d65' | 'xyz-d50'",
    components: type(["number | 'none'", "number | 'none'", "number | 'none'"]),
    alpha: "(0 <= number <= 1)?",
    hex: type("/^#[\\dA-Fa-f]{6}$/"),
  }),
}).describe("Color");

export const Dimension = type({
  $type: "'dimension'",
  /** `px` needs to be convered to `dp` on Android and `pt` on iOS  | `1rem` on Android is eqilvalent to `16sp` */
  $value: ValueAlias.or(NumberValue),
}).describe("Dimension");

export const FontFamily = type({
  $type: "'fontFamily'",
  $value: ValueAlias.or("string | string[]"),
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

const FontFamilyValue = ValueAlias.or("string | string[]");
const DimensionValue = ValueAlias.or(NumberValue);
const FontWeightValue = ValueAlias.or(
  type("1 <= number <= 1000").or(FontWeightNames)
);
const NumberLiteralValue = ValueAlias.or("number");

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

const Extensions = type({ "[string]": "unknown" });

const CommonMetadata = type({
  "$description?": "string",
  "$extensions?": Extensions,
  "$deprecated?": "boolean | string",
});

export const Token = Color.or(Dimension)
  .or(FontFamily)
  .or(FontWeight)
  .or(Duration)
  .or(CubicBezier)
  .or(Number)
  .or(Shadow)
  .or(StrokeStyle)
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
