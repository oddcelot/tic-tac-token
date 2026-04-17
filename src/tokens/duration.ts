import { type } from "arktype";
import { ValueAlias } from "./shared.ts";

export const DurationValue = ValueAlias.or(
  type({ value: "number", unit: "'ms' | 's'" })
);

export const Duration = type({
  $type: "'duration'",
  $value: DurationValue,
}).describe("Duration");
