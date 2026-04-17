import { describe, expect, it } from "vitest";
import { Duration } from "../schema.ts";
import { isInvalid, isValid } from "./helpers.ts";

describe("duration token (DTCG §8.5)", () => {
  it("accepts integer ms", () => {
    expect(
      isValid(Duration({ $type: "duration", $value: { value: 100, unit: "ms" } })),
    ).toBe(true);
  });

  it("accepts integer s", () => {
    expect(
      isValid(Duration({ $type: "duration", $value: { value: 2, unit: "s" } })),
    ).toBe(true);
  });

  it("rejects unknown units", () => {
    expect(
      isInvalid(
        Duration({ $type: "duration", $value: { value: 100, unit: "minutes" } }),
      ),
    ).toBe(true);
  });

  it.fails(
    "gap: spec allows floating-point durations (e.g. 1.5s); schema.ts constrains value to number.integer",
    () => {
      expect(
        isValid(
          Duration({ $type: "duration", $value: { value: 1.5, unit: "s" } }),
        ),
      ).toBe(true);
    },
  );
});
