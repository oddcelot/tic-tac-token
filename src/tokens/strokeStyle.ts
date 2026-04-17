import { type } from "arktype";
import { DimensionPrimitive, ValueAlias } from "./shared.ts";

export const StrokeStyleEnum = type(
  "'solid' | 'dashed' | 'dotted' | 'double' | 'groove' | 'ridge' | 'outset' | 'inset'"
);

export const StrokeStyleObject = type({
  dashArray: DimensionPrimitive.array(),
  lineCap: "'round' | 'butt' | 'square'",
}).onUndeclaredKey("reject");

export const StrokeStyleValue = ValueAlias.or(StrokeStyleEnum).or(
  StrokeStyleObject,
);

export const StrokeStyle = type({
  $type: "'strokeStyle'",
  $value: StrokeStyleValue,
}).describe("Stroke Style");
