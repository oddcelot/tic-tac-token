import { describe, expect, it } from "vitest";
import { Border } from "../src/index.ts";
import { isInvalid, isValid } from "./helpers.ts";

const base = {
  color: {
    colorSpace: "srgb",
    components: [0.218, 0.218, 0.218],
    alpha: 1,
    hex: "#373737",
  },
  width: { value: 3, unit: "px" },
  style: "solid",
} as const;

describe("border token (DTCG §9.4)", () => {
  it("accepts a full border $value with a string style", () => {
    expect(isValid(Border({ $type: "border", $value: base }))).toBe(true);
  });

  it("accepts a border with an object strokeStyle", () => {
    expect(
      isValid(
        Border({
          $type: "border",
          $value: {
            ...base,
            style: {
              dashArray: [
                { value: 0.5, unit: "rem" },
                { value: 0.25, unit: "rem" },
              ],
              lineCap: "round",
            },
          },
        }),
      ),
    ).toBe(true);
  });

  it("accepts curly-brace refs for each sub-value", () => {
    expect(
      isValid(
        Border({
          $type: "border",
          $value: {
            color: "{colors.border}",
            width: "{sizing.border}",
            style: "{strokes.default}",
          },
        }),
      ),
    ).toBe(true);
  });

  it("accepts a curly-brace alias as the whole $value", () => {
    expect(
      isValid(Border({ $type: "border", $value: "{borders.default}" })),
    ).toBe(true);
  });

  it("rejects a non-spec style string", () => {
    expect(
      isInvalid(
        Border({
          $type: "border",
          $value: { ...base, style: "squiggly" },
        }),
      ),
    ).toBe(true);
  });

  it("rejects a border missing a required property", () => {
    const { width: _width, ...incomplete } = base;
    expect(isInvalid(Border({ $type: "border", $value: incomplete }))).toBe(
      true,
    );
  });

  it("rejects an unknown key on the $value object", () => {
    expect(
      isInvalid(
        Border({
          $type: "border",
          $value: { ...base, radius: { value: 4, unit: "px" } } as never,
        }),
      ),
    ).toBe(true);
  });
});
