import { describe, expect, it } from "vitest";
import {
  Color,
  CubicBezier,
  Dimension,
  Duration,
  FontFamily,
  Gradient,
  Number as TokenNumber,
  Shadow,
  StrokeStyle,
  Token,
  Transition,
  Typography,
} from "../src/index.ts";
import { isInvalid, isValid } from "./helpers.ts";

const ref = (pointer: string) => ({ $ref: pointer });

describe("nested $ref objects (DTCG §4.2 nested form)", () => {
  it("accepts $ref as a dimension sub-value (value field)", () => {
    expect(
      isValid(
        Dimension({
          $type: "dimension",
          $value: { value: ref("#/base/spacing/$value/value"), unit: "rem" },
        }),
      ),
    ).toBe(true);
  });

  it("accepts $ref as a dimension sub-value (unit field)", () => {
    expect(
      isValid(
        Dimension({
          $type: "dimension",
          $value: { value: 16, unit: ref("#/base/units/$value") },
        }),
      ),
    ).toBe(true);
  });

  it("accepts $ref inside color.components", () => {
    expect(
      isValid(
        Color({
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [ref("#/base/red/$value/components/0"), 0, 0],
          },
        }),
      ),
    ).toBe(true);
  });

  it("accepts $ref as color.alpha", () => {
    expect(
      isValid(
        Color({
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [0, 0, 0],
            alpha: ref("#/base/opacity/$value"),
          },
        }),
      ),
    ).toBe(true);
  });

  it("accepts $ref inside cubicBezier control points", () => {
    expect(
      isValid(
        CubicBezier({
          $type: "cubicBezier",
          $value: [ref("#/curves/ease-in/$value/0"), 0, 1, 1],
        }),
      ),
    ).toBe(true);
  });

  it("accepts $ref as duration.value", () => {
    expect(
      isValid(
        Duration({
          $type: "duration",
          $value: { value: ref("#/timings/short/$value/value"), unit: "ms" },
        }),
      ),
    ).toBe(true);
  });

  it("accepts $ref as a fontFamily stack element", () => {
    expect(
      isValid(
        FontFamily({
          $type: "fontFamily",
          $value: [ref("#/families/primary/$value"), "sans-serif"],
        }),
      ),
    ).toBe(true);
  });

  it("accepts $ref as a typography sub-value", () => {
    expect(
      isValid(
        Typography({
          $type: "typography",
          $value: {
            fontFamily: "Roboto",
            fontSize: ref("#/sizes/lg/$value"),
            fontWeight: 400,
            letterSpacing: { value: 0, unit: "px" },
            lineHeight: 1.4,
          },
        }),
      ),
    ).toBe(true);
  });

  it("accepts $ref as a shadow sub-value", () => {
    expect(
      isValid(
        Shadow({
          $type: "shadow",
          $value: {
            color: ref("#/colors/shadow/$value"),
            offsetX: { value: 0, unit: "px" },
            offsetY: { value: 2, unit: "px" },
            blur: { value: 4, unit: "px" },
            spread: { value: 0, unit: "px" },
          },
        }),
      ),
    ).toBe(true);
  });

  it("accepts $ref as a shadow array element", () => {
    expect(
      isValid(
        Shadow({
          $type: "shadow",
          $value: [
            {
              color: { colorSpace: "srgb", components: [0, 0, 0], alpha: 0.5 },
              offsetX: { value: 0, unit: "px" },
              offsetY: { value: 1, unit: "px" },
              blur: { value: 2, unit: "px" },
              spread: { value: 0, unit: "px" },
            },
            ref("#/shadows/glow/$value"),
          ],
        }),
      ),
    ).toBe(true);
  });

  it("accepts $ref as a gradient stop", () => {
    expect(
      isValid(
        Gradient({
          $type: "gradient",
          $value: [
            {
              color: { colorSpace: "srgb", components: [0, 0, 0] },
              position: 0,
            },
            ref("#/gradients/mid/$value"),
            {
              color: ref("#/colors/end/$value"),
              position: ref("#/positions/end/$value"),
            },
          ],
        }),
      ),
    ).toBe(true);
  });

  it("accepts $ref as a border sub-value", () => {
    expect(
      isValid(
        Token({
          $type: "border",
          $value: {
            color: ref("#/colors/line/$value"),
            width: { value: 1, unit: "px" },
            style: "solid",
          },
        }),
      ),
    ).toBe(true);
  });

  it("accepts $ref as a transition sub-value", () => {
    expect(
      isValid(
        Transition({
          $type: "transition",
          $value: {
            duration: ref("#/timings/short/$value"),
            delay: { value: 0, unit: "ms" },
            timingFunction: [0.4, 0, 0.2, 1],
          },
        }),
      ),
    ).toBe(true);
  });

  it("accepts $ref as a strokeStyle dashArray element", () => {
    expect(
      isValid(
        StrokeStyle({
          $type: "strokeStyle",
          $value: {
            dashArray: [ref("#/spacing/xs/$value"), { value: 4, unit: "px" }],
            lineCap: "round",
          },
        }),
      ),
    ).toBe(true);
  });

  it("accepts $ref as a whole $value on a number token (spec primaryHue example)", () => {
    expect(
      isValid(
        TokenNumber({
          $type: "number",
          $value: ref("#/base/blue/$value/components/0"),
        }),
      ),
    ).toBe(true);
  });

  it("rejects a nested $ref that is not a JSON Pointer", () => {
    expect(
      isInvalid(
        Dimension({
          $type: "dimension",
          $value: { value: ref("not-a-pointer"), unit: "rem" },
        }),
      ),
    ).toBe(true);
  });

  it("rejects a nested $ref object with unknown sibling keys", () => {
    expect(
      isInvalid(
        Dimension({
          $type: "dimension",
          $value: {
            value: { $ref: "#/x/$value", extra: 1 } as never,
            unit: "rem",
          },
        }),
      ),
    ).toBe(true);
  });
});
