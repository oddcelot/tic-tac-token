import { type } from "arktype";
import { DimensionValue } from "./dimension.ts";
import { JsonPointerRefObject, ValueAlias } from "./shared.ts";

export const StrokeStyleEnum = type(
  "'solid' | 'dashed' | 'dotted' | 'double' | 'groove' | 'ridge' | 'outset' | 'inset'"
);

export const StrokeStyleObject = type({
  dashArray: DimensionValue.array(),
  lineCap: type("'round' | 'butt' | 'square'").or(JsonPointerRefObject),
}).onUndeclaredKey("reject");

export const StrokeStyleValue = ValueAlias.or(JsonPointerRefObject)
  .or(StrokeStyleEnum)
  .or(StrokeStyleObject);

export const StrokeStyle = type({
  $type: "'strokeStyle'",
  $value: StrokeStyleValue,
}).describe("Stroke Style");
