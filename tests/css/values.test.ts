import { describe, expect, it } from "vitest";
import {
  borderToCss,
  cubicBezierToCss,
  durationToCss,
  gradientToCss,
  numberToCss,
  shadowToCss,
  strokeStyleToCss,
  toCssValue,
  tokenToCssDeclarations,
  transitionToCss,
} from "../../src/css.ts";
import { TOKEN_TYPES, type FlatToken, type TokenType } from "../../src/resolver/types.ts";

const token = (t: { $type: TokenType; $value: unknown }): FlatToken => ({
  path: "x",
  typeInherited: false,
  ...t,
});

const px = (value: number) => ({ value, unit: "px" as const });
const hex = (h: string) => ({ colorSpace: "srgb", components: [0, 0, 0], alpha: 1, hex: h });

describe("duration", () => {
  it("formats ms and s", () => {
    expect(durationToCss({ value: 200, unit: "ms" })).toBe("200ms");
    expect(durationToCss({ value: 0.2, unit: "s" })).toBe("0.2s");
  });
  it("rejects other units and shapes", () => {
    expect(durationToCss({ value: 200, unit: "min" })).toBeNull();
    expect(durationToCss({ value: "200", unit: "ms" })).toBeNull();
    expect(durationToCss(200)).toBeNull();
  });
});

describe("number", () => {
  it("emits a bare numeric string", () => {
    expect(numberToCss(1.5)).toBe("1.5");
    expect(numberToCss(0)).toBe("0");
    expect(numberToCss(-2)).toBe("-2");
  });
  it("rejects non-finite and non-numbers", () => {
    expect(numberToCss(Number.NaN)).toBeNull();
    expect(numberToCss(Number.POSITIVE_INFINITY)).toBeNull();
    expect(numberToCss("1.5")).toBeNull();
  });
});

describe("cubicBezier", () => {
  it("emits cubic-bezier()", () => {
    expect(cubicBezierToCss([0.4, 0, 0.2, 1])).toBe("cubic-bezier(0.4, 0, 0.2, 1)");
  });
  it("rejects wrong arity and non-numeric points", () => {
    expect(cubicBezierToCss([0.4, 0, 0.2])).toBeNull();
    expect(cubicBezierToCss([0.4, 0, 0.2, "1"])).toBeNull();
    expect(cubicBezierToCss("ease")).toBeNull();
  });
});

describe("strokeStyle", () => {
  it("passes through all eight DTCG keywords, which are valid CSS line styles", () => {
    for (const kw of ["solid", "dashed", "dotted", "double", "groove", "ridge", "outset", "inset"]) {
      expect(strokeStyleToCss(kw)).toBe(kw);
    }
  });
  it("has no shorthand for the dash-pattern object form", () => {
    expect(strokeStyleToCss({ dashArray: [px(2)], lineCap: "round" })).toBeNull();
    expect(strokeStyleToCss("wavy")).toBeNull();
  });
  it("emits dashArray and lineCap as sub-properties", () => {
    const decls = tokenToCssDeclarations(
      token({ $type: "strokeStyle", $value: { dashArray: [px(2), px(4)], lineCap: "round" } }),
    );
    expect(decls).toEqual([
      { suffix: "dashArray", value: "2px 4px" },
      { suffix: "lineCap", value: "round" },
    ]);
  });
});

describe("border", () => {
  const value = { width: px(1), style: "solid", color: hex("#000000") };

  it("emits the CSS shorthand in width/style/color order", () => {
    expect(borderToCss(value)).toBe("1px solid #000000");
  });
  it("has no shorthand when style is the dash-pattern object form", () => {
    expect(borderToCss({ ...value, style: { dashArray: [px(2)], lineCap: "butt" } })).toBeNull();
  });
  it("emits shorthand plus sub-properties", () => {
    expect(tokenToCssDeclarations(token({ $type: "border", $value: value }))).toEqual([
      { suffix: "", value: "1px solid #000000" },
      { suffix: "width", value: "1px" },
      { suffix: "style", value: "solid" },
      { suffix: "color", value: "#000000" },
    ]);
  });
  it("still emits the usable sub-properties when the shorthand is unavailable", () => {
    const decls = tokenToCssDeclarations(
      token({
        $type: "border",
        $value: { ...value, style: { dashArray: [px(2)], lineCap: "butt" } },
      }),
    );
    expect(decls.map((d) => d.suffix)).toEqual(["width", "color"]);
  });
});

describe("transition", () => {
  const value = {
    duration: { value: 200, unit: "ms" },
    delay: { value: 0, unit: "ms" },
    timingFunction: [0.4, 0, 0.2, 1],
  };

  it("orders as duration, timing-function, delay so CSS reads the delay second", () => {
    expect(transitionToCss(value)).toBe("200ms cubic-bezier(0.4, 0, 0.2, 1) 0ms");
  });
  it("emits shorthand plus sub-properties", () => {
    expect(tokenToCssDeclarations(token({ $type: "transition", $value: value }))).toEqual([
      { suffix: "", value: "200ms cubic-bezier(0.4, 0, 0.2, 1) 0ms" },
      { suffix: "duration", value: "200ms" },
      { suffix: "delay", value: "0ms" },
      { suffix: "timingFunction", value: "cubic-bezier(0.4, 0, 0.2, 1)" },
    ]);
  });
  it("rejects a partial value", () => {
    expect(transitionToCss({ duration: { value: 200, unit: "ms" } })).toBeNull();
  });
});

describe("shadow", () => {
  const layer = {
    color: hex("#000000"),
    offsetX: px(0),
    offsetY: px(1),
    blur: px(2),
    spread: px(0),
  };

  it("emits a single layer", () => {
    expect(shadowToCss(layer)).toBe("0px 1px 2px 0px #000000");
  });
  it("prefixes inset", () => {
    expect(shadowToCss({ ...layer, inset: true })).toBe("inset 0px 1px 2px 0px #000000");
    expect(shadowToCss({ ...layer, inset: false })).toBe("0px 1px 2px 0px #000000");
  });
  it("comma-joins the array form in declaration order", () => {
    expect(shadowToCss([layer, { ...layer, offsetY: px(4) }])).toBe(
      "0px 1px 2px 0px #000000, 0px 4px 2px 0px #000000",
    );
  });
  it("rejects an empty array or a layer missing a field", () => {
    expect(shadowToCss([])).toBeNull();
    expect(shadowToCss([layer, { color: hex("#000000") }])).toBeNull();
  });
});

describe("gradient", () => {
  const stops = [
    { color: hex("#ffffff"), position: 0 },
    { color: hex("#000000"), position: 1 },
  ];

  it("emits a bare stop list by default, so it composes into any gradient function", () => {
    expect(gradientToCss(stops)).toBe("#ffffff 0%, #000000 100%");
  });
  it("wraps in linear-gradient() only when asked", () => {
    expect(gradientToCss(stops, { gradient: "linear" })).toBe(
      "linear-gradient(#ffffff 0%, #000000 100%)",
    );
  });
  it("converts fractional positions to percentages", () => {
    expect(gradientToCss([{ color: hex("#ffffff"), position: 0.25 }])).toBe("#ffffff 25%");
  });
  it("rejects a stop with no position or an empty list", () => {
    expect(gradientToCss([{ color: hex("#ffffff") }])).toBeNull();
    expect(gradientToCss([])).toBeNull();
  });
});

describe("typography", () => {
  const value = {
    fontFamily: ["Inter", "Segoe UI"],
    fontSize: px(16),
    fontWeight: "bold",
    letterSpacing: { value: 0.5, unit: "px" },
    lineHeight: 1.5,
  };

  it("emits no shorthand — CSS `font` cannot express letterSpacing", () => {
    expect(toCssValue(token({ $type: "typography", $value: value }))).toBeNull();
  });

  it("emits one sub-property per declared field", () => {
    expect(tokenToCssDeclarations(token({ $type: "typography", $value: value }))).toEqual([
      { suffix: "fontFamily", value: 'Inter, "Segoe UI"' },
      { suffix: "fontSize", value: "16px" },
      { suffix: "fontWeight", value: "700" },
      { suffix: "letterSpacing", value: "0.5px" },
      { suffix: "lineHeight", value: "1.5" },
    ]);
  });
});

describe("tokenToCssDeclarations", () => {
  it("honours subProperties: false", () => {
    const t = token({
      $type: "border",
      $value: { width: px(1), style: "solid", color: hex("#000000") },
    });
    expect(tokenToCssDeclarations(t, { subProperties: false })).toEqual([
      { suffix: "", value: "1px solid #000000" },
    ]);
  });

  it("returns [] for a malformed value rather than throwing", () => {
    for (const $type of TOKEN_TYPES) {
      expect(tokenToCssDeclarations(token({ $type, $value: undefined }))).toEqual([]);
    }
  });

  it("covers every DTCG type — no type silently emits nothing for a valid value", () => {
    const samples: Record<TokenType, unknown> = {
      color: hex("#ff0000"),
      dimension: px(16),
      fontFamily: ["Inter"],
      fontWeight: "bold",
      duration: { value: 200, unit: "ms" },
      cubicBezier: [0.4, 0, 0.2, 1],
      number: 1.5,
      strokeStyle: "dashed",
      border: { width: px(1), style: "solid", color: hex("#000000") },
      transition: {
        duration: { value: 200, unit: "ms" },
        delay: { value: 0, unit: "ms" },
        timingFunction: [0.4, 0, 0.2, 1],
      },
      shadow: { color: hex("#000000"), offsetX: px(0), offsetY: px(1), blur: px(2), spread: px(0) },
      gradient: [{ color: hex("#ffffff"), position: 0 }],
      typography: {
        fontFamily: ["Inter"],
        fontSize: px(16),
        fontWeight: "regular",
        letterSpacing: px(0),
        lineHeight: 1.5,
      },
    };

    for (const $type of TOKEN_TYPES) {
      const decls = tokenToCssDeclarations(token({ $type, $value: samples[$type] }));
      expect(decls.length, `${$type} emitted nothing`).toBeGreaterThan(0);
    }
  });
});
