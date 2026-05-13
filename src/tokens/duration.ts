import { type } from "arktype";
import { JsonPointerRefObject, ValueAlias } from "./shared.ts";

export const DurationValue = ValueAlias.or(JsonPointerRefObject).or(
  type({
    value: type("number").or(JsonPointerRefObject),
    unit: type("'ms' | 's'").or(JsonPointerRefObject),
  }).onUndeclaredKey("reject")
);

export const Duration = type({
  $type: "'duration'",
  $value: DurationValue,
}).describe("Duration");
