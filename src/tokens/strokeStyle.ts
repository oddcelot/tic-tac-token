import { type } from "arktype";
import { DimensionValue } from "./dimension.ts";
import { ValueAlias } from "./shared.ts";

export const StrokeStyleEnum = type(
  "'solid' | 'dashed' | 'dotted' | 'double' | 'groove' | 'ridge' | 'outset' | 'inset'"
);

export const StrokeStyleObject = type({
  dashArray: DimensionValue.array(),
  lineCap: "'round' | 'butt' | 'square'",
}).onUndeclaredKey("reject");

export const StrokeStyleValue = ValueAlias.or(StrokeStyleEnum).or(
  StrokeStyleObject,
);

export const StrokeStyle = type({
  $type: "'strokeStyle'",
  $value: StrokeStyleValue,
}).describe("Stroke Style");
