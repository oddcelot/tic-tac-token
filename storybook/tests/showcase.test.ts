import { describe, expect, it } from "vitest";
import { tokenShowcase } from "../src/preview/tokenShowcase.ts";
import { PARAM_KEY } from "../src/preview/tokens.ts";

const color = (hex: string) => ({
  $type: "color" as const,
  $value: { colorSpace: "srgb", components: [0, 0, 0], alpha: 1, hex },
});

const resolver = {
  version: "2025.10",
  modifiers: {
    theme: {
      default: "astro",
      contexts: {
        astro: [{ color: { bg: color("#aaaaaa") } }],
        cosmos: [{ color: { bg: color("#bbbbbb") } }],
      },
    },
  },
  resolutionOrder: [{ $ref: "#/modifiers/theme" }],
};

const fallbackRaw = JSON.stringify({ color: { fallback: color("#ffffff") } });
const explicitRaw = JSON.stringify({ color: { explicit: color("#111111") } });

const hexes = (el: HTMLElement): string[] =>
  ((el as unknown as { tokens: { $value: { hex: string } }[] }).tokens ?? []).map(
    (t) => t.$value.hex,
  );

describe("tokenShowcase render", () => {
  it("renders the project's resolver document at the active context", () => {
    const show = tokenShowcase({ type: "color", fallbackRaw });
    const el = show.render(
      {},
      { parameters: { [PARAM_KEY]: { resolver } }, globals: { theme: "cosmos" } },
    );
    expect(hexes(el)).toEqual(["#bbbbbb"]);
  });

  it("uses the bundled fallback only when the project supplied nothing", () => {
    const show = tokenShowcase({ type: "color", fallbackRaw });
    expect(hexes(show.render({}, {}))).toEqual(["#ffffff"]);
  });

  it("never lets the fallback shadow a real document", () => {
    const show = tokenShowcase({ type: "color", fallbackRaw });
    const el = show.render({}, { parameters: { [PARAM_KEY]: { resolver } }, globals: {} });
    expect(hexes(el)).toEqual(["#aaaaaa"]);
    expect(hexes(el)).not.toContain("#ffffff");
  });

  it("lets an explicit raw document override the project's", () => {
    const show = tokenShowcase({ type: "color", raw: explicitRaw, fallbackRaw });
    const el = show.render({}, { parameters: { [PARAM_KEY]: { resolver } }, globals: {} });
    expect(hexes(el)).toEqual(["#111111"]);
  });

  it("still accepts a function form for raw", () => {
    const show = tokenShowcase({ type: "color", raw: () => explicitRaw });
    expect(hexes(show.render({}, {}))).toEqual(["#111111"]);
  });

  it("filters to the requested token type", () => {
    const mixed = {
      version: "2025.10",
      resolutionOrder: [
        {
          name: "base",
          type: "set",
          sources: [
            {
              color: { bg: color("#aaaaaa") },
              size: { md: { $type: "dimension", $value: { value: 16, unit: "px" } } },
            },
          ],
        },
      ],
    };
    const show = tokenShowcase({ type: "color" });
    const el = show.render({}, { parameters: { [PARAM_KEY]: { resolver: mixed } }, globals: {} });
    expect(hexes(el)).toEqual(["#aaaaaa"]);
  });

  it("renders an empty element rather than throwing when there are no tokens", () => {
    const show = tokenShowcase({ type: "color" });
    expect(hexes(show.render({}, {}))).toEqual([]);
  });

  it("still throws for a token type with no showcase component", () => {
    expect(() => tokenShowcase({ type: "shadow" })).toThrow(/no showcase component/);
  });
});
