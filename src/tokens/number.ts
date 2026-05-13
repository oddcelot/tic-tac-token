import { type } from "arktype";
import { JsonPointerRefObject, ValueAlias } from "./shared.ts";

export const NumberLiteralValue = ValueAlias.or(JsonPointerRefObject).or(
  "number"
);

export const Number = type({
  $type: "'number'",
  $value: NumberLiteralValue,
}).describe("Number");
