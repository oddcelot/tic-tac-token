import { type } from "arktype";
import { ColorValue } from "./color.ts";
import { ValueAlias } from "./shared.ts";

export const GradientStop = type({
  color: ColorValue,
  // DTCG 2025.10 prose (§6.5 / §7) says out-of-range positions are clamped
  // to [0, 1]. The canonical JSON Schema rejects them, and so do we — JSON
  // Schema can't express clamping. Clamping belongs in a resolver pass.
  // See tests/gradient.test.ts: "rejects positions outside [0, 1]".
  position: ValueAlias.or("0 <= number <= 1"),
}).onUndeclaredKey("reject");

// Per DTCG 2025.10 §9.7: array elements are gradient stop objects OR refs
// to gradient/stop tokens (a curly-brace alias string).
export const GradientValue = ValueAlias.or(
  GradientStop.or(ValueAlias).array().atLeastLength(1),
);

export const Gradient = type({
  $type: "'gradient'",
  $value: GradientValue,
}).describe("Gradient");
