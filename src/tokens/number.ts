import { type } from "arktype";
import { ValueAlias } from "./shared.ts";

export const NumberLiteralValue = ValueAlias.or("number");

export const Number = type({
  $type: "'number'",
  $value: NumberLiteralValue,
}).describe("Number");
