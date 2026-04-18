import { describe, expect, it } from "vitest";
import { StrokeStyle } from "../src/index.ts";
import { isInvalid, isValid } from "./helpers.ts";

describe("strokeStyle token — string enum form (DTCG §9.3)", () => {
  const specValues = [
    "solid",
    "dashed",
    "dotted",
    "double",
    "groove",
    "ridge",
    "outset",
    "inset",
  ] as const;

  it.each(specValues)("accepts %s", (value) => {
    expect(isValid(StrokeStyle({ $type: "strokeStyle", $value: value }))).toBe(
      true,
    );
  });

  it("rejects non-spec values 'none' and 'hidden'", () => {
    expect(
      isInvalid(StrokeStyle({ $type: "strokeStyle", $value: "none" })),
    ).toBe(true);
    expect(
      isInvalid(StrokeStyle({ $type: "strokeStyle", $value: "hidden" })),
    ).toBe(true);
  });

  it("accepts a curly-brace alias", () => {
    expect(
      isValid(StrokeStyle({ $type: "strokeStyle", $value: "{border.style}" })),
    ).toBe(true);
  });
});

describe("strokeStyle token — object form (DTCG §9.3)", () => {
  const lineCaps = ["round", "butt", "square"] as const;

  it.each(lineCaps)("accepts lineCap = %s", (lineCap) => {
    expect(
      isValid(
        StrokeStyle({
          $type: "strokeStyle",
          $value: {
            dashArray: [
              { value: 0.5, unit: "rem" },
              { value: 0.25, unit: "rem" },
            ],
            lineCap,
          },
        }),
      ),
    ).toBe(true);
  });

  it("accepts dashArray with more than 2 elements", () => {
    expect(
      isValid(
        StrokeStyle({
          $type: "strokeStyle",
          $value: {
            dashArray: [
              { value: 0.5, unit: "rem" },
              { value: 0.25, unit: "rem" },
              { value: 0.1, unit: "rem" },
            ],
            lineCap: "round",
          },
        }),
      ),
    ).toBe(true);
  });

  it("accepts a dashArray with a single element (odd-count; spec clarifies it's duplicated)", () => {
    expect(
      isValid(
        StrokeStyle({
          $type: "strokeStyle",
          $value: {
            dashArray: [{ value: 0.5, unit: "rem" }],
            lineCap: "round",
          },
        }),
      ),
    ).toBe(true);
  });

  it("rejects an unknown lineCap", () => {
    expect(
      isInvalid(
        StrokeStyle({
          $type: "strokeStyle",
          $value: {
            dashArray: [{ value: 0.5, unit: "rem" }],
            lineCap: "triangle",
          },
        }),
      ),
    ).toBe(true);
  });

  it("rejects an empty dashArray (spec: minItems 1)", () => {
    expect(
      isInvalid(
        StrokeStyle({
          $type: "strokeStyle",
          $value: { dashArray: [], lineCap: "round" },
        }),
      ),
    ).toBe(true);
  });

  it("accepts curly-brace alias entries in dashArray", () => {
    expect(
      isValid(
        StrokeStyle({
          $type: "strokeStyle",
          $value: {
            dashArray: [
              "{sizing.dash}",
              { value: 0.25, unit: "rem" },
              "{sizing.gap}",
            ],
            lineCap: "round",
          },
        }),
      ),
    ).toBe(true);
  });
});
