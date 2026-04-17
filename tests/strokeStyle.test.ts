import { describe, expect, it } from "vitest";
import { Stroke, StrokeStyle } from "../schema.ts";
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
  ];

  // NOTE: schema.ts exports these via `Stroke` (with $type: 'stroke'), not the
  // `StrokeStyle` composite. The spec puts them under $type: 'strokeStyle'.
  it.each(specValues)(
    "accepts spec string enum value %s (via Stroke export)",
    (value) => {
      expect(isValid(Stroke({ $type: "stroke", $value: value }))).toBe(true);
    },
  );

  it.fails(
    "gap: Stroke.$type is 'stroke' but DTCG spec uses 'strokeStyle' for the string-enum form",
    () => {
      expect(
        isValid(
          // Using the spec's own $type literal
          Stroke({ $type: "strokeStyle", $value: "solid" } as unknown as {
            $type: "stroke";
            $value: "solid";
          }),
        ),
      ).toBe(true);
    },
  );

  it.fails(
    "gap: schema.ts:114 accepts 'none' and 'hidden', which are not in the DTCG strokeStyle enum",
    () => {
      expect(isInvalid(Stroke({ $type: "stroke", $value: "none" }))).toBe(true);
      expect(isInvalid(Stroke({ $type: "stroke", $value: "hidden" }))).toBe(
        true,
      );
    },
  );
});

describe("strokeStyle token — object form (DTCG §9.3)", () => {
  it("accepts a round lineCap with a 2-element dashArray", () => {
    expect(
      isValid(
        StrokeStyle({
          $type: "strokeStyle",
          $value: {
            dashArray: [
              { value: 0.5, unit: "rem" },
              { value: 0.25, unit: "rem" },
            ],
            lineCap: "round",
          },
        }),
      ),
    ).toBe(true);
  });

  it.fails(
    "gap: spec allows lineCap = 'butt'; schema.ts:122 only accepts 'round'",
    () => {
      expect(
        isValid(
          StrokeStyle({
            $type: "strokeStyle",
            $value: {
              dashArray: [
                { value: 0.5, unit: "rem" },
                { value: 0.25, unit: "rem" },
              ],
              lineCap: "butt",
            },
          }),
        ),
      ).toBe(true);
    },
  );

  it.fails(
    "gap: spec allows lineCap = 'square'; schema.ts:122 only accepts 'round'",
    () => {
      expect(
        isValid(
          StrokeStyle({
            $type: "strokeStyle",
            $value: {
              dashArray: [
                { value: 0.5, unit: "rem" },
                { value: 0.25, unit: "rem" },
              ],
              lineCap: "square",
            },
          }),
        ),
      ).toBe(true);
    },
  );

  it.fails(
    "gap: spec allows a dashArray of arbitrary length; schema.ts:121 requires exactly 2 elements",
    () => {
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
    },
  );
});
