import { type } from "arktype";
import { ColorValue } from "./color.ts";
import { ValueAlias } from "./shared.ts";

export const GradientStop = type({
  color: ColorValue,
  position: ValueAlias.or("number"),
}).onUndeclaredKey("reject");

export const Gradient = type({
  $type: "'gradient'",
  $value: ValueAlias.or(GradientStop.array()),
}).describe("Gradient");
