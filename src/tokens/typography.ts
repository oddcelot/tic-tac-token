import { type } from "arktype";
import { DimensionValue } from "./dimension.ts";
import { FontFamilyValue } from "./fontFamily.ts";
import { FontWeightValue } from "./fontWeight.ts";
import { NumberLiteralValue } from "./number.ts";
import { ValueAlias } from "./shared.ts";

export const Typography = type({
  $type: "'typography'",
  $value: ValueAlias.or(
    type({
      fontFamily: FontFamilyValue,
      fontSize: DimensionValue,
      fontWeight: FontWeightValue,
      letterSpacing: DimensionValue,
      lineHeight: NumberLiteralValue,
    }).onUndeclaredKey("reject"),
  ),
}).describe("Typography");
