import { describe, expect, it } from "vitest";
import { Transition } from "../src/index.ts";
import { isInvalid, isValid } from "./helpers.ts";

const base = {
  duration: { value: 200, unit: "ms" },
  delay: { value: 0, unit: "ms" },
  timingFunction: [0.5, 0, 1, 1],
} as const;

describe("transition token (DTCG §9.5)", () => {
  it("accepts a full transition $value", () => {
    expect(isValid(Transition({ $type: "transition", $value: base }))).toBe(
      true,
    );
  });

  it("accepts curly-brace refs for each sub-value", () => {
    expect(
      isValid(
        Transition({
          $type: "transition",
          $value: {
            duration: "{motion.base}",
            delay: "{motion.delay.none}",
            timingFunction: "{motion.easing.in}",
          },
        }),
      ),
    ).toBe(true);
  });

  it("accepts a curly-brace alias as the whole $value", () => {
    expect(
      isValid(Transition({ $type: "transition", $value: "{motion.fade}" })),
    ).toBe(true);
  });

  it("rejects an invalid timingFunction (P1x out of [0,1])", () => {
    expect(
      isInvalid(
        Transition({
          $type: "transition",
          $value: { ...base, timingFunction: [1.5, 0, 1, 1] },
        }),
      ),
    ).toBe(true);
  });

  it("rejects a duration with an invalid unit", () => {
    expect(
      isInvalid(
        Transition({
          $type: "transition",
          $value: { ...base, duration: { value: 5, unit: "minutes" } },
        }),
      ),
    ).toBe(true);
  });

  it("rejects an unknown key on the $value object", () => {
    expect(
      isInvalid(
        Transition({
          $type: "transition",
          $value: { ...base, repeat: "infinite" } as never,
        }),
      ),
    ).toBe(true);
  });
});
