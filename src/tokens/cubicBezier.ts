import { type } from "arktype";
import { ValueAlias } from "./shared.ts";

export const CubicBezierValue = ValueAlias.or(
  type(["0 <= number <= 1", "number", "0 <= number <= 1", "number"])
);

export const CubicBezier = type({
  $type: "'cubicBezier'",
  $value: CubicBezierValue,
}).describe("Cubic Bezier");
