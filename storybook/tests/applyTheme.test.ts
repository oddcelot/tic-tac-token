import { beforeEach, describe, expect, it } from "vitest";
import { STYLE_MARKER, applyTokenTheme } from "../src/preview/applyTheme.ts";
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
        astro: [{ color: { bg: color("#ffffff") } }],
        cosmos: [{ color: { bg: color("#faf7ff") } }],
      },
    },
    colorScheme: {
      default: "light",
      $extensions: { "tic-tac-token.css": { colorScheme: true } },
      contexts: {
        light: [{ color: { fg: color("#000000") } }],
        dark: [{ color: { fg: color("#ffffff") } }],
      },
    },
  },
  resolutionOrder: [{ $ref: "#/modifiers/theme" }, { $ref: "#/modifiers/colorScheme" }],
};

const ctx = (globals: Record<string, string> = {}, document: unknown = resolver) => ({
  parameters: { [PARAM_KEY]: { resolver: document } },
  globals,
});

const styles = () => document.head.querySelectorAll(`style[${STYLE_MARKER}="vars"]`);
const sheet = () => styles()[0]?.textContent ?? "";

beforeEach(() => {
  document.head.innerHTML = "";
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-color-scheme");
  document.documentElement.style.colorScheme = "";
  document.body.style.colorScheme = "";
});

describe("applyTokenTheme — style injection", () => {
  it("writes exactly one marked style element containing a :root block", () => {
    applyTokenTheme(ctx());
    expect(styles()).toHaveLength(1);
    expect(sheet()).toContain(":root {");
    expect(sheet()).toContain("--color-bg: #ffffff;");
  });

  it("replaces the block on a globals change instead of appending a second one", () => {
    applyTokenTheme(ctx());
    applyTokenTheme(ctx({ theme: "cosmos" }));
    expect(styles()).toHaveLength(1);
    expect(sheet()).toContain("--color-bg: #faf7ff;");
    expect(sheet()).not.toContain("#ffffff");
  });

  it("leaves the DOM untouched when nothing changed", () => {
    applyTokenTheme(ctx());
    const before = styles()[0]!;
    const text = before.textContent;
    applyTokenTheme(ctx());
    expect(styles()[0]).toBe(before);
    expect(styles()[0]?.textContent).toBe(text);
  });

  it("honours a custom selector", () => {
    applyTokenTheme(ctx(), { cssSelector: "html" });
    expect(sheet()).toContain("html {");
  });

  it("skips injection but still sets attributes when cssSelector is false", () => {
    applyTokenTheme(ctx({ theme: "cosmos" }), { cssSelector: false });
    expect(styles()).toHaveLength(0);
    expect(document.documentElement.getAttribute("data-theme")).toBe("cosmos");
  });
});

describe("applyTokenTheme — attributes", () => {
  it("mirrors every modifier's active context onto a kebab-cased data attribute", () => {
    applyTokenTheme(ctx({ theme: "cosmos", colorScheme: "dark" }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("cosmos");
    expect(document.documentElement.getAttribute("data-color-scheme")).toBe("dark");
  });

  it("writes the defaults when no globals are set", () => {
    applyTokenTheme(ctx());
    expect(document.documentElement.getAttribute("data-theme")).toBe("astro");
    expect(document.documentElement.getAttribute("data-color-scheme")).toBe("light");
  });

  it("can be turned off", () => {
    applyTokenTheme(ctx({ theme: "cosmos" }), { attributes: false });
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(sheet()).toContain(":root {");
  });

  it("sets nothing for the legacy raw-document path", () => {
    const raw = JSON.stringify({ color: { a: color("#ffffff") } });
    applyTokenTheme({ parameters: { [PARAM_KEY]: { raw } }, globals: {} });
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(sheet()).toContain("--color-a: #ffffff;");
  });
});

describe("applyTokenTheme — color-scheme", () => {
  it("sets style.colorScheme from the marked modifier", () => {
    applyTokenTheme(ctx({ colorScheme: "dark" }));
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(document.body.style.colorScheme).toBe("dark");
  });

  it("leaves it alone for a context CSS has no value for", () => {
    const sepia = {
      version: "2025.10",
      resolutionOrder: [
        {
          name: "appearance",
          type: "modifier",
          default: "sepia",
          $extensions: { "tic-tac-token.css": { colorScheme: true } },
          contexts: { sepia: [{ color: { bg: color("#f4ecd8") } }], dark: [{ color: { bg: color("#000000") } }] },
        },
      ],
    };
    applyTokenTheme(ctx({ appearance: "sepia" }, sepia));
    expect(document.documentElement.style.colorScheme).toBe("");
  });

  it("leaves it alone when no modifier is the color-scheme one", () => {
    const noScheme = {
      version: "2025.10",
      resolutionOrder: [
        {
          name: "density",
          type: "modifier",
          default: "cozy",
          contexts: { cozy: [{ color: { bg: color("#ffffff") } }], compact: [{ color: { bg: color("#eeeeee") } }] },
        },
      ],
    };
    applyTokenTheme(ctx({ density: "compact" }, noScheme));
    expect(document.documentElement.style.colorScheme).toBe("");
    expect(document.documentElement.getAttribute("data-density")).toBe("compact");
  });
});

describe("applyTokenTheme — return value", () => {
  it("hands back the resolution the caller can render from", () => {
    const resolution = applyTokenTheme(ctx({ theme: "cosmos" }));
    expect(resolution.inputs).toEqual({ theme: "cosmos", colorScheme: "light" });
    expect(resolution.byPath.get("color.bg")?.$value).toMatchObject({ hex: "#faf7ff" });
  });

  it("does not throw for an invalid document", () => {
    expect(() => applyTokenTheme(ctx({}, { version: "2024.1" }))).not.toThrow();
  });
});
