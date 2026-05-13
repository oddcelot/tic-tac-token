import { type } from "arktype";
import { ColorValue } from "./color.ts";
import { JsonPointerRefObject, ValueAlias } from "./shared.ts";

export const GradientStop = type({
  color: ColorValue,
  // DTCG 2025.10 prose (§6.5 / §7) clamps out-of-range positions to [0, 1].
  // Validation accepts any number; clamping is a resolver-pass concern that
  // can't be expressed in JSON Schema.
  position: ValueAlias.or(JsonPointerRefObject).or("number"),
}).onUndeclaredKey("reject");

// Per DTCG 2025.10 §9.7: array elements are gradient stop objects OR refs
// to gradient/stop tokens (curly-brace alias string or `$ref` object).
const gradientArrayItem = GradientStop.or(ValueAlias).or(JsonPointerRefObject);

export const GradientValue = ValueAlias.or(JsonPointerRefObject).or(
  gradientArrayItem.array().atLeastLength(1),
);

export const Gradient = type({
  $type: "'gradient'",
  $value: GradientValue,
}).describe("Gradient");
