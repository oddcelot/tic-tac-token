import { type } from "arktype";
import { ValueAlias } from "./shared.ts";

export const FontWeightNames = type.enumerated(
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

export const FontWeightValue = ValueAlias.or(
  type("1 <= number <= 1000").or(FontWeightNames)
);

export const FontWeight = type({
  $type: "'fontWeight'",
  $value: FontWeightValue,
}).describe("Font Weight");
