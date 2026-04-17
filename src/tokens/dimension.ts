import { type } from "arktype";
import { DimensionPrimitive, ValueAlias } from "./shared.ts";

export const DimensionValue = ValueAlias.or(DimensionPrimitive);

export const Dimension = type({
  $type: "'dimension'",
  /** `px` needs to be converted to `dp` on Android and `pt` on iOS. `1rem` on Android is equivalent to `16sp`. */
  $value: DimensionValue,
}).describe("Dimension");
