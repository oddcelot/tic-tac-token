import { type } from "arktype";
import { ValueAlias } from "./shared.ts";

export const FontFamilyValue = ValueAlias.or("string").or("string[] >= 1");

export const FontFamily = type({
  $type: "'fontFamily'",
  $value: FontFamilyValue,
}).describe("Font Family");
