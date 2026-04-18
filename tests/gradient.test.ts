import { describe, expect, it } from "vitest";
import { Gradient } from "../src/index.ts";
import { isInvalid, isValid } from "./helpers.ts";

const stop = (position: unknown, hex = "#ff0000") => ({
  color: { colorSpace: "srgb", components: [1, 0, 0], alpha: 1, hex },
  position,
});

describe("gradient token (DTCG §9.7)", () => {
  it("accepts a two-stop gradient", () => {
    expect(
      isValid(
        Gradient({
          $type: "gradient",
          $value: [stop(0, "#0000ff"), stop(1, "#ff0000")],
        }),
      ),
    ).toBe(true);
  });

  it("accepts multi-stop gradients", () => {
    expect(
      isValid(
        Gradient({
          $type: "gradient",
          $value: [stop(0), stop(0.25), stop(0.5), stop(0.75), stop(1)],
        }),
      ),
    ).toBe(true);
  });

  it("accepts curly-brace refs for color and position", () => {
    expect(
      isValid(
        Gradient({
          $type: "gradient",
          $value: [
            { color: "{colors.start}", position: "{stops.start}" },
            { color: "{colors.end}", position: "{stops.end}" },
          ],
        }),
      ),
    ).toBe(true);
  });

  it("accepts a curly-brace alias as the whole $value", () => {
    expect(
      isValid(Gradient({ $type: "gradient", $value: "{gradients.brand}" })),
    ).toBe(true);
  });

  it("rejects positions outside [0, 1] (per DTCG 2025.10 JSON schema)", () => {
    expect(
      isInvalid(
        Gradient({ $type: "gradient", $value: [stop(-0.01), stop(1)] }),
      ),
    ).toBe(true);
    expect(
      isInvalid(
        Gradient({ $type: "gradient", $value: [stop(0), stop(1.01)] }),
      ),
    ).toBe(true);
  });

  it("rejects a non-numeric, non-alias position", () => {
    expect(
      isInvalid(
        Gradient({ $type: "gradient", $value: [stop("start"), stop(1)] }),
      ),
    ).toBe(true);
  });

  it("rejects a stop missing color or position", () => {
    expect(
      isInvalid(
        Gradient({
          $type: "gradient",
          $value: [{ position: 0 } as unknown as ReturnType<typeof stop>],
        }),
      ),
    ).toBe(true);
  });

  it("rejects a non-array $value", () => {
    expect(
      isInvalid(Gradient({ $type: "gradient", $value: stop(0.5) })),
    ).toBe(true);
  });

  it("rejects an empty gradient array (spec: minItems 1)", () => {
    expect(
      isInvalid(Gradient({ $type: "gradient", $value: [] })),
    ).toBe(true);
  });
});
