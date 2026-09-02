import { describe, expect, it } from "vitest";
import {
  basePath,
  cssVarSegments,
  isEmittablePath,
  kebabCase,
  pathToCssVar,
  subPropertyVar,
} from "../../src/css.ts";

describe("kebabCase", () => {
  it("splits camelCase and PascalCase", () => {
    expect(kebabCase("itemGap")).toBe("item-gap");
    expect(kebabCase("BrandPrimary")).toBe("brand-primary");
  });
  it("keeps acronyms readable", () => {
    expect(kebabCase("APIKey")).toBe("api-key");
    expect(kebabCase("HTTPSProxy")).toBe("https-proxy");
  });
  it("passes through already-kebab and lowercase segments", () => {
    expect(kebabCase("primary")).toBe("primary");
    expect(kebabCase("brand-primary")).toBe("brand-primary");
  });
});

describe("pathToCssVar", () => {
  it("kebab-cases each segment and joins with -", () => {
    expect(pathToCssVar("color.primary")).toBe("--color-primary");
    expect(pathToCssVar("space.itemGap")).toBe("--space-item-gap");
    expect(pathToCssVar("font.family.sans")).toBe("--font-family-sans");
    expect(pathToCssVar("space")).toBe("--space");
  });

  it("drops a $root segment — the group's own token IS the group's name", () => {
    expect(pathToCssVar("color.accent.$root")).toBe("--color-accent");
    expect(pathToCssVar("color.accent")).toBe("--color-accent");
  });

  it("strips a mode suffix so a role's var name is stable across schemes", () => {
    expect(pathToCssVar("color.primary@dark")).toBe("--color-primary");
    expect(pathToCssVar("color.primary@high-contrast")).toBe("--color-primary");
  });

  it("is deliberately not reversible — collisions are the emitter's problem", () => {
    expect(pathToCssVar("color.brandPrimary")).toBe("--color-brand-primary");
    expect(pathToCssVar("color.brand.primary")).toBe("--color-brand-primary");
  });
});

describe("basePath", () => {
  it("strips only a trailing mode suffix", () => {
    expect(basePath("color.primary@dark")).toBe("color.primary");
    expect(basePath("color.primary")).toBe("color.primary");
    expect(basePath("color.primary@dark@light")).toBe("color.primary@dark");
  });
});

describe("cssVarSegments", () => {
  it("returns the kebab-cased, $root-free, mode-free segments", () => {
    expect(cssVarSegments("color.accent.$root@dark")).toEqual(["color", "accent"]);
    expect(cssVarSegments("space.itemGap")).toEqual(["space", "item-gap"]);
  });
  it("drops empty segments from a malformed path", () => {
    expect(cssVarSegments("color..primary")).toEqual(["color", "primary"]);
  });
});

describe("isEmittablePath", () => {
  it("accepts any path with at least one real segment", () => {
    expect(isEmittablePath("color.primary")).toBe(true);
    expect(isEmittablePath("color.accent.$root")).toBe(true);
  });
  it("rejects the empty path and a bare document-root $root", () => {
    expect(isEmittablePath("")).toBe(false);
    expect(isEmittablePath("$root")).toBe(false);
  });
});

describe("subPropertyVar", () => {
  it("kebab-cases the suffix", () => {
    expect(subPropertyVar("--border-focus", "color")).toBe("--border-focus-color");
    expect(subPropertyVar("--type-body", "fontSize")).toBe("--type-body-font-size");
    expect(subPropertyVar("--motion-fade", "timingFunction")).toBe(
      "--motion-fade-timing-function",
    );
  });
});
