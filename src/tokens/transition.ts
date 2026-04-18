import { type } from "arktype";
import { CubicBezierValue } from "./cubicBezier.ts";
import { DurationValue } from "./duration.ts";
import { ValueAlias } from "./shared.ts";

export const TransitionValue = ValueAlias.or(
  type({
    duration: DurationValue,
    delay: DurationValue,
    timingFunction: CubicBezierValue,
  }).onUndeclaredKey("reject"),
);

export const Transition = type({
  $type: "'transition'",
  $value: TransitionValue,
}).describe("Transition");
