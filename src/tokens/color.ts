import { type } from "arktype";
import { ValueAlias } from "./shared.ts";

export const ColorValue = ValueAlias.or(
  type({
    colorSpace:
      "'srgb' | 'srgb-linear' | 'hsl' | 'hwb' | 'lab' | 'lch' | 'oklab' | 'oklch' | 'display-p3' | 'a98-rgb' | 'prophoto-rgb' | 'rec2020' | 'xyz-d65' | 'xyz-d50'",
    components: type(["number | 'none'", "number | 'none'", "number | 'none'"]),
    alpha: "(0 <= number <= 1)?",
    hex: type("/^#[\\dA-Fa-f]{6}$/"),
  })
);

export const Color = type({
  $type: "'color'",
  $value: ColorValue,
}).describe("Color");
