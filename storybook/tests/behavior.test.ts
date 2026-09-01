import { describe, it, expect } from "vitest";
import {
  PARAM_KEY,
  tokenDocumentFromParameters,
  parseTokens,
  tokensOfType,
  formatTokenValue,
} from "../src/preview/tokens.ts";
import {
  tokenShowcase,
  type TokenRenderContext,
} from "../src/preview/tokenShowcase.ts";

// A compact DTCG document with a light/dark mode variant and an alias.
const DOC = JSON.stringify({
  color: {
    primary: {
      $type: "color",
      $value: "{color.accent}",
      $extensions: {
        "tic-tac-token.modes": {
          dark: { colorSpace: "srgb", components: [1, 0, 0], alpha: 1, hex: "#FF0000" },
        },
      },
    },
    accent: {
      $type: "color",
      $value: { colorSpace: "srgb", components: [0, 0.5, 1], alpha: 1, hex: "#0080FF" },
    },
  },
  spacing: {
    card: { $type: "dimension", $value: { value: 16, unit: "px" } },
  },
  font: {
    weight: { bold: { $type: "fontWeight", $value: "bold" } },
    family: { sans: { $type: "fontFamily", $value: ["Inter", "sans-serif"] } },
  },
});

const ctx = ({
  parameters,
  globals,
}: {
  parameters?: Record<string, unknown>;
  globals?: Record<string, unknown>;
}): TokenRenderContext => ({ parameters, globals });

describe("tokenDocumentFromParameters", () => {
  it("returns the raw string when the parameter is a bare document", () => {
    expect(tokenDocumentFromParameters(ctx({ parameters: { [PARAM_KEY]: DOC } }))).toBe(DOC);
  });

  it("picks the document for the active theme global", () => {
    const parameters = { [PARAM_KEY]: { documents: { astro: "ASTRO_RAW", cosmos: "COSMOS_RAW" } } };
    expect(tokenDocumentFromParameters(ctx({ parameters, globals: { theme: "cosmos" } }))).toBe(
      "COSMOS_RAW",
    );
  });

  it("falls back to the first document when the theme is unknown", () => {
    const parameters = { [PARAM_KEY]: { documents: { astro: "ASTRO_RAW", cosmos: "COSMOS_RAW" } } };
    expect(tokenDocumentFromParameters(ctx({ parameters, globals: { theme: "nope" } }))).toBe(
      "ASTRO_RAW",
    );
    expect(tokenDocumentFromParameters(ctx({ parameters, globals: {} }))).toBe("ASTRO_RAW");
  });

  it("returns undefined when nothing is supplied", () => {
    expect(tokenDocumentFromParameters(ctx({ parameters: {} }))).toBeUndefined();
  });
});

describe("parseTokens", () => {
  it("parses and resolves aliases in light mode, dropping mode variants", () => {
    const tokens = parseTokens(DOC, "light");
    const primary = tokens.find((t) => t.path === "color.primary");
    // alias resolved to the accent color
    expect(primary?.$value).toMatchObject({ hex: "#0080FF" });
    expect(tokens.find((t) => t.mode === "dark")).toBeUndefined();
  });

  it("replaces default tokens with their dark-mode variant in dark mode", () => {
    const tokens = parseTokens(DOC, "dark");
    const primary = tokens.find((t) => t.path === "color.primary@dark");
    expect(primary).toBeDefined();
    expect(primary?.mode).toBe("dark");
    expect(primary?.$value).toMatchObject({ hex: "#FF0000" });
    // unchanged tokens keep their light value and no mode
    expect(tokens.find((t) => t.path === "spacing.card")?.mode).toBeUndefined();
    // the base light primary is excluded now that a dark variant exists
    expect(tokens.some((t) => t.path === "color.primary" && !t.mode)).toBe(false);
  });

  it("returns an empty list for invalid JSON", () => {
    expect(parseTokens("not json")).toEqual([]);
  });
});

describe("tokensOfType", () => {
  it("filters by token type", () => {
    const colors = tokensOfType(parseTokens(DOC, "light"), "color");
    expect(colors.every((t) => t.$type === "color")).toBe(true);
    expect(colors.length).toBeGreaterThan(0);
  });
});

describe("formatTokenValue", () => {
  it("formats a color as its hex", () => {
    const t = tokensOfType(parseTokens(DOC, "light"), "color")[0]!;
    expect(formatTokenValue(t)).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it("normalizes a named font weight to a number", () => {
    const t = parseTokens(DOC, "light").find((x) => x.path === "font.weight.bold")!;
    expect(formatTokenValue(t)).toBe("700");
  });

  it("renders a dimension with its unit", () => {
    const t = parseTokens(DOC, "light").find((x) => x.path === "spacing.card")!;
    expect(formatTokenValue(t)).toBe("16px");
  });
});

describe("tokenShowcase", () => {
  it("maps a requested type to its showcase element and a render fn", () => {
    const show = tokenShowcase({ type: "color", raw: DOC });
    expect(show.component).toBe("token-color");
    expect(typeof show.render).toBe("function");
    expect(show.args?.mode).toBe("light");
  });

  it("resolves the document from context when raw is a function", () => {
    const parameters = { [PARAM_KEY]: { documents: { astro: DOC } } };
    const show = tokenShowcase({
      type: "color",
      raw: () => tokenDocumentFromParameters({ parameters, globals: { theme: "astro" } }) ?? "",
    });
    const el = show.render(
      { mode: "light", sample: "x" },
      { parameters, globals: { colorScheme: "light" } },
    );
    expect(el).toBeInstanceOf(HTMLElement);
  });

  it("lets the colorScheme global win over the per-story mode arg", () => {
    const show = tokenShowcase({ type: "color", raw: DOC });
    // global dark wins over args.mode light
    const darkEl = show.render({ mode: "light" }, { globals: { colorScheme: "dark" } });
    expect(darkEl.mode).toBe("dark");
    // explicit global light wins over args.mode dark
    const lightEl = show.render({ mode: "dark" }, { globals: { colorScheme: "light" } });
    expect(lightEl.mode).toBe("light");
  });

  it("falls back to args.mode when no colorScheme global is set", () => {
    const show = tokenShowcase({ type: "color", raw: DOC });
    const el = show.render({ mode: "dark" }, {});
    expect(el.mode).toBe("dark");
  });

  it("throws for an unsupported token type", () => {
    expect(() => tokenShowcase({ type: "duration" as never })).toThrowError(/no showcase component/);
  });
});