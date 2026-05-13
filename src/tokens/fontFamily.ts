import { type } from "arktype";
import { JsonPointerRefObject, ValueAlias } from "./shared.ts";

const familyEntry = type("string").or(JsonPointerRefObject);

export const FontFamilyValue = ValueAlias.or(JsonPointerRefObject)
  .or("string")
  .or(familyEntry.array().atLeastLength(1));

export const FontFamily = type({
  $type: "'fontFamily'",
  $value: FontFamilyValue,
}).describe("Font Family");
