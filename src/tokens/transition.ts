import { type } from "arktype";
import { CubicBezierValue } from "./cubicBezier.ts";
import { DurationValue } from "./duration.ts";
import { ValueAlias } from "./shared.ts";

export const Transition = type({
  $type: "'transition'",
  $value: ValueAlias.or({
    duration: DurationValue,
    delay: DurationValue,
    timingFunction: CubicBezierValue,
  }),
}).describe("Transition");
