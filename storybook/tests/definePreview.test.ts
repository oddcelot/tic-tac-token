import { beforeEach, describe, expect, it } from "vitest";
import {
  externalDocumentsFrom,
  tokenPreviewAddon,
} from "../src/preview/definePreview.ts";
import { PARAM_KEY } from "../src/preview/tokens.ts";
import { STYLE_MARKER } from "../src/preview/applyTheme.ts";

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
  },
  resolutionOrder: [{ $ref: "#/modifiers/theme" }],
};

beforeEach(() => {
  document.head.innerHTML = "";
  document.documentElement.removeAttribute("data-theme");
});

describe("tokenPreviewAddon — resolver documents", () => {
  it("derives the toolbar from the document's modifiers", () => {
    const addon = tokenPreviewAddon({ resolver });
    expect(Object.keys(addon.globalTypes)).toEqual(["theme"]);
    expect(addon.globalTypes["theme"]?.toolbar.items.map((i) => i.value)).toEqual([
      "astro",
      "cosmos",
    ]);
    expect(addon.initialGlobals).toEqual({ theme: "astro" });
  });

  it("publishes the document through the addon's parameter key", () => {
    const addon = tokenPreviewAddon({ resolver, externalDocuments: { "a.json": {} } });
    expect(addon.parameters[PARAM_KEY]).toEqual({
      resolver,
      externalDocuments: { "a.json": {} },
    });
  });

  it("returns a decorator that renders the story and applies the theme", () => {
    const addon = tokenPreviewAddon({ resolver });
    const story = () => "STORY";
    const rendered = addon.decorators[0]!(story as never, {
      parameters: addon.parameters,
      globals: { theme: "cosmos" },
    } as never);

    expect(rendered).toBe("STORY");
    expect(document.documentElement.getAttribute("data-theme")).toBe("cosmos");
    expect(document.head.querySelector(`style[${STYLE_MARKER}="vars"]`)?.textContent).toContain(
      "--color-bg: #faf7ff;",
    );
  });

  it("passes apply options through to the decorator", () => {
    const addon = tokenPreviewAddon({ resolver, attributes: false });
    addon.decorators[0]!((() => null) as never, {
      parameters: addon.parameters,
      globals: { theme: "cosmos" },
    } as never);
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });

  it("lets the consumer override a derived global", () => {
    const addon = tokenPreviewAddon({
      resolver,
      globalTypes: {
        theme: { toolbar: { title: "Brand", items: [{ value: "astro", title: "A" }] } },
      },
      initialGlobals: { theme: "cosmos" },
    });
    expect(addon.globalTypes["theme"]?.toolbar.title).toBe("Brand");
    expect(addon.initialGlobals["theme"]).toBe("cosmos");
  });

  it("adds a consumer global alongside the derived ones", () => {
    const addon = tokenPreviewAddon({
      resolver,
      globalTypes: { locale: { toolbar: { title: "Locale", items: [{ value: "en", title: "EN" }] } } },
    });
    expect(Object.keys(addon.globalTypes).sort()).toEqual(["locale", "theme"]);
  });
});

describe("tokenPreviewAddon — surviving a clobbered parameters key", () => {
  it("still resolves when the consumer overwrites parameters entirely", () => {
    // `{ ...tokenPreviewAddon({ resolver }), parameters: { … } }` drops the
    // addon's parameters on the floor. That is ordinary JS, easy to write, and
    // its only symptom is an empty stylesheet — so the factory registers the
    // source directly as well.
    const addon = tokenPreviewAddon({ resolver });
    const clobbered = { ...addon, parameters: { controls: { expanded: true } } };

    clobbered.decorators[0]!((() => null) as never, {
      parameters: clobbered.parameters,
      globals: { theme: "cosmos" },
    } as never);

    expect(document.documentElement.getAttribute("data-theme")).toBe("cosmos");
    expect(
      document.head.querySelector(`style[${STYLE_MARKER}="vars"]`)?.textContent,
    ).toContain("--color-bg: #faf7ff;");
  });

  it("lets a story's own parameters still override the registered source", () => {
    const other = {
      version: "2025.10",
      resolutionOrder: [
        { name: "base", type: "set", sources: [{ color: { bg: color("#010203") } }] },
      ],
    };
    const addon = tokenPreviewAddon({ resolver });

    addon.decorators[0]!((() => null) as never, {
      parameters: { [PARAM_KEY]: { resolver: other } },
      globals: {},
    } as never);

    expect(
      document.head.querySelector(`style[${STYLE_MARKER}="vars"]`)?.textContent,
    ).toContain("--color-bg: #010203;");
  });
});

describe("tokenPreviewAddon — legacy shapes", () => {
  it("reproduces the theme and colorScheme globals for { documents }", () => {
    const addon = tokenPreviewAddon({ documents: { astro: "{}", cosmos: "{}" } });
    expect(Object.keys(addon.globalTypes).sort()).toEqual(["colorScheme", "theme"]);
    expect(addon.globalTypes["theme"]?.toolbar.items.map((i) => i.value)).toEqual([
      "astro",
      "cosmos",
    ]);
    expect(addon.initialGlobals).toEqual({ colorScheme: "light", theme: "astro" });
    expect(addon.parameters[PARAM_KEY]).toEqual({ documents: { astro: "{}", cosmos: "{}" } });
  });

  it("registers only colorScheme for a single { raw } document", () => {
    const addon = tokenPreviewAddon({ raw: "{}" });
    expect(Object.keys(addon.globalTypes)).toEqual(["colorScheme"]);
    expect(addon.parameters[PARAM_KEY]).toEqual({ raw: "{}" });
  });

  it("ignores the legacy shapes when a resolver document is supplied", () => {
    const addon = tokenPreviewAddon({ resolver, raw: "{}", documents: { a: "{}" } });
    expect(Object.keys(addon.globalTypes)).toEqual(["theme"]);
    expect(addon.parameters[PARAM_KEY]).toMatchObject({ resolver });
  });

  it("registers nothing at all when given no tokens", () => {
    const addon = tokenPreviewAddon();
    expect(addon.parameters).toEqual({});
    expect(addon.decorators).toHaveLength(1);
  });
});

describe("externalDocumentsFrom", () => {
  it("strips the glob's relative prefix so keys match the document's $refs", () => {
    expect(
      externalDocumentsFrom({
        "../tokens/base.json": { a: 1 },
        "../tokens/themes/astro.json": { b: 2 },
      }),
    ).toEqual({ "tokens/base.json": { a: 1 }, "tokens/themes/astro.json": { b: 2 } });
  });

  it("strips a repeated prefix", () => {
    expect(externalDocumentsFrom({ "../../tokens/base.json": {} })).toEqual({
      "tokens/base.json": {},
    });
  });

  it("accepts a custom prefix and normalises a leading ./", () => {
    expect(externalDocumentsFrom({ "src/tokens/a.json": {} }, { stripPrefix: "src/" })).toEqual({
      "tokens/a.json": {},
    });
    expect(externalDocumentsFrom({ "./tokens/a.json": {} })).toEqual({ "tokens/a.json": {} });
  });

  it("leaves an already-bare key alone", () => {
    expect(externalDocumentsFrom({ "tokens/base.json": {} })).toEqual({
      "tokens/base.json": {},
    });
  });
});
