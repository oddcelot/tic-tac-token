import { type } from "arktype";
import { JsonPointerRefObject, ValueAlias } from "./shared.ts";

const xPoint = type("0 <= number <= 1").or(JsonPointerRefObject);
const yPoint = type("number").or(JsonPointerRefObject);

export const CubicBezierValue = ValueAlias.or(JsonPointerRefObject).or(
  type([xPoint, yPoint, xPoint, yPoint])
);

export const CubicBezier = type({
  $type: "'cubicBezier'",
  $value: CubicBezierValue,
}).describe("Cubic Bezier");
