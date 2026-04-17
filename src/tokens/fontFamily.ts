import { type } from "arktype";
import { ValueAlias } from "./shared.ts";

export const FontFamilyValue = ValueAlias.or("string | string[]");

export const FontFamily = type({
  $type: "'fontFamily'",
  $value: FontFamilyValue,
}).describe("Font Family");
