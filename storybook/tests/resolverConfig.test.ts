import { describe, expect, it } from "vitest";
import {
  attributeFor,
  colorSchemeModifier,
  globalNameFor,
  initialContextFor,
  inputsFromGlobals,
  titleCase,
  tokenGlobalTypes,
  tokenInitialGlobals,
} from "../src/preview/resolverConfig.ts";

const color = (hex: string) => ({
  $type: "color" as const,
  $value: { colorSpace: "srgb", components: [0, 0, 0], alpha: 1, hex },
});

const doc = {
  version: "2025.10",
  modifiers: {
    theme: {
      default: "astro",
      description: "Brand palette.",
      contexts: {
        astro: [{ color: { bg: color("#ffffff") } }],
        cosmos: [{ color: { bg: color("#faf7ff") } }],
      },
    },
    colorScheme: {
      default: "light",
      $extensions: {
        "tic-tac-token.css": { colorScheme: true },
        "tic-tac-token.storybook": { title: "Color scheme", labels: { dark: "Dark mode" } },
      },
      contexts: {
        light: [{ color: { fg: color("#000000") } }],
        dark: [{ color: { fg: color("#ffffff") } }],
      },
    },
    // Declared but never referenced by resolutionOrder.
    unused: {
      default: "a",
      contexts: { a: [{}], b: [{}] },
    },
  },
  resolutionOrder: [{ $ref: "#/modifiers/theme" }, { $ref: "#/modifiers/colorScheme" }],
};

describe("titleCase", () => {
  it("humanises a modifier name", () => {
    expect(titleCase("theme")).toBe("Theme");
    expect(titleCase("colorScheme")).toBe("Color scheme");
    expect(titleCase("high-contrast")).toBe("High contrast");
  });
});

describe("tokenGlobalTypes", () => {
  it("derives one dropdown per modifier, in resolutionOrder order", () => {
    expect(Object.keys(tokenGlobalTypes(doc))).toEqual(["theme", "colorScheme"]);
  });

  it("uses context names as item values and title-cases their labels", () => {
    expect(tokenGlobalTypes(doc)["theme"]?.toolbar.items).toEqual([
      { value: "astro", title: "Astro" },
      { value: "cosmos", title: "Cosmos" },
    ]);
  });

  it("honours $extensions title and labels", () => {
    const scheme = tokenGlobalTypes(doc)["colorScheme"]!;
    expect(scheme.toolbar.title).toBe("Color scheme");
    expect(scheme.toolbar.items).toEqual([
      { value: "light", title: "Light" },
      { value: "dark", title: "Dark mode" },
    ]);
  });

  it("carries the modifier description through", () => {
    expect(tokenGlobalTypes(doc)["theme"]?.description).toBe("Brand palette.");
  });

  it("excludes a modifier resolutionOrder never references", () => {
    // Its name is not a valid input — the resolver would raise
    // `unknown-input-key` — so a dropdown for it would be a trap.
    expect(tokenGlobalTypes(doc)["unused"]).toBeUndefined();
  });

  it("honours a `global` override for a colliding name", () => {
    const renamed = {
      ...doc,
      modifiers: {
        ...doc.modifiers,
        theme: {
          ...doc.modifiers.theme,
          $extensions: { "tic-tac-token.storybook": { global: "ttt-theme" } },
        },
      },
    };
    expect(Object.keys(tokenGlobalTypes(renamed))).toContain("ttt-theme");
    expect(Object.keys(tokenGlobalTypes(renamed))).not.toContain("theme");
  });

  it("returns {} for an invalid or absent document without throwing", () => {
    expect(tokenGlobalTypes({ version: "2024.1", resolutionOrder: [] })).toEqual({});
    expect(tokenGlobalTypes(null)).toEqual({});
    expect(tokenGlobalTypes(undefined)).toEqual({});
  });
});

describe("tokenInitialGlobals", () => {
  it("starts each modifier at its declared default", () => {
    expect(tokenInitialGlobals(doc)).toEqual({ theme: "astro", colorScheme: "light" });
  });

  it("falls back to the first context when no default is declared", () => {
    const noDefault = {
      version: "2025.10",
      resolutionOrder: [
        { name: "density", type: "modifier", contexts: { cozy: [{}], compact: [{}] } },
      ],
    };
    expect(tokenInitialGlobals(noDefault)).toEqual({ density: "cozy" });
    expect(initialContextFor({ name: "d", contexts: ["a", "b"] })).toBe("a");
  });
});

describe("inputsFromGlobals", () => {
  it("maps the active globals onto resolver inputs", () => {
    expect(inputsFromGlobals(doc, { theme: "cosmos", colorScheme: "dark" })).toEqual({
      theme: "cosmos",
      colorScheme: "dark",
    });
  });

  it("matches context values case-insensitively, normalising to the declared casing", () => {
    expect(inputsFromGlobals(doc, { theme: "COSMOS" })).toMatchObject({ theme: "cosmos" });
  });

  it("falls back to the default for a global naming an unknown context", () => {
    expect(inputsFromGlobals(doc, { theme: "nope" })).toMatchObject({ theme: "astro" });
  });

  it("drops globals that name no modifier, so nothing reaches unknown-input-key", () => {
    const inputs = inputsFromGlobals(doc, { viewport: "mobile", backgrounds: "dark" });
    expect(Object.keys(inputs).sort()).toEqual(["colorScheme", "theme"]);
  });

  it("keys inputs by the modifier name even when the global is renamed", () => {
    const renamed = {
      ...doc,
      modifiers: {
        ...doc.modifiers,
        theme: {
          ...doc.modifiers.theme,
          $extensions: { "tic-tac-token.storybook": { global: "ttt-theme" } },
        },
      },
    };
    expect(inputsFromGlobals(renamed, { "ttt-theme": "cosmos" })).toMatchObject({
      theme: "cosmos",
    });
  });

  it("returns the defaults when no globals are supplied at all", () => {
    expect(inputsFromGlobals(doc, undefined)).toEqual({ theme: "astro", colorScheme: "light" });
  });
});

describe("colorSchemeModifier", () => {
  it("prefers the explicit $extensions marker", () => {
    expect(colorSchemeModifier(doc)?.name).toBe("colorScheme");
  });

  it("lets a differently-named modifier opt in", () => {
    const appearance = {
      version: "2025.10",
      resolutionOrder: [
        {
          name: "appearance",
          type: "modifier",
          default: "light",
          $extensions: { "tic-tac-token.css": { colorScheme: true } },
          contexts: { light: [{}], dark: [{}] },
        },
      ],
    };
    expect(colorSchemeModifier(appearance)?.name).toBe("appearance");
  });

  it("falls back to the conventional name when nothing is marked", () => {
    const conventional = {
      version: "2025.10",
      resolutionOrder: [
        { name: "colorScheme", type: "modifier", contexts: { light: [{}], dark: [{}] } },
      ],
    };
    expect(colorSchemeModifier(conventional)?.name).toBe("colorScheme");
  });

  it("is undefined when nothing matches", () => {
    const none = {
      version: "2025.10",
      resolutionOrder: [
        { name: "density", type: "modifier", contexts: { cozy: [{}], compact: [{}] } },
      ],
    };
    expect(colorSchemeModifier(none)).toBeUndefined();
    expect(colorSchemeModifier(null)).toBeUndefined();
  });
});

describe("attributeFor", () => {
  it("kebab-cases the modifier name", () => {
    expect(attributeFor({ name: "colorScheme", contexts: [] })).toBe("data-color-scheme");
    expect(attributeFor({ name: "theme", contexts: [] })).toBe("data-theme");
  });

  it("honours an override and an opt-out", () => {
    const ext = (attribute: string | false) => ({
      name: "theme",
      contexts: [],
      $extensions: { "tic-tac-token.storybook": { attribute } },
    });
    expect(attributeFor(ext("data-brand"))).toBe("data-brand");
    expect(attributeFor(ext(false))).toBeUndefined();
  });
});

describe("globalNameFor", () => {
  it("defaults to the modifier name", () => {
    expect(globalNameFor({ name: "theme", contexts: [] })).toBe("theme");
  });
});
