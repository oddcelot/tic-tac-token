// End-to-end check against the demo's real resolver document on disk.
//
// This is the one test that exercises the whole chain the way a project does:
// load files → resolve a combination → emit a themed stylesheet. It is also
// what catches a demo token file being edited into an inconsistent state,
// which no unit test would notice.
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { resolverDocumentToCssTheme } from "../../src/css.ts";
import { loadResolverDocumentSync } from "../../src/node/load.ts";
import { resolveResolverDocument, resolverModifiers } from "../../src/resolver-module/index.ts";

const ENTRY = fileURLToPath(
  new URL("../../examples/storybook-demo/resolver.json", import.meta.url),
);

/** The roles the demo's card styles itself from. */
const ROLES = [
  "color.primary",
  "color.accent",
  "color.background",
  "color.surface",
  "color.ink",
  "spacing.card",
  "spacing.radius",
  "font.family.sans",
  "font.weight.bold",
];

const loaded = loadResolverDocumentSync(ENTRY);

describe("examples/storybook-demo", () => {
  it("loads with no missing or unreadable references", () => {
    expect(loaded.errors).toEqual([]);
    expect(Object.keys(loaded.externalDocuments).sort()).toEqual([
      "tokens/base.tokens.json",
      "tokens/palette/astro.tokens.json",
      "tokens/palette/cosmos.tokens.json",
      "tokens/scheme/dark.tokens.json",
      "tokens/scheme/light.tokens.json",
    ]);
  });

  it("declares exactly the two modifiers the toolbar shows", () => {
    expect(resolverModifiers(loaded.document).map((m) => [m.name, m.contexts])).toEqual([
      ["theme", ["astro", "cosmos"]],
      ["colorScheme", ["light", "dark"]],
    ]);
  });

  it("resolves every combination cleanly, with every role present", () => {
    for (const theme of ["astro", "cosmos"]) {
      for (const colorScheme of ["light", "dark"]) {
        const result = resolveResolverDocument(
          loaded.document,
          { theme, colorScheme },
          { externalDocuments: loaded.externalDocuments },
        );
        const where = `${theme}/${colorScheme}`;
        expect(result.documentErrors, where).toEqual([]);
        expect(result.tokenErrors, where).toEqual([]);
        for (const role of ROLES) {
          expect(result.tokens.byPath.has(role), `${role} @ ${where}`).toBe(true);
        }
      }
    }
  });

  it("gives each combination its own background, proving merge precedes aliasing", () => {
    // `tokens/scheme/*.json` say only `{palette.background.<scheme>}` and never
    // name a theme; the literal comes from whichever palette merged alongside.
    const bg = (theme: string, colorScheme: string) =>
      (
        resolveResolverDocument(loaded.document, { theme, colorScheme }, {
          externalDocuments: loaded.externalDocuments,
        }).tokens.byPath.get("color.background")?.$value as { hex: string }
      ).hex;

    const seen = [
      bg("astro", "light"),
      bg("astro", "dark"),
      bg("cosmos", "light"),
      bg("cosmos", "dark"),
    ];
    expect(new Set(seen).size).toBe(4);
  });

  it("emits a themed stylesheet with no diagnostics", () => {
    const sheet = resolverDocumentToCssTheme(loaded.document, {
      externalDocuments: loaded.externalDocuments,
    });
    expect(sheet.documentErrors).toEqual([]);
    expect(sheet.tokenErrors).toEqual([]);
    expect(sheet.diagnostics).toEqual([]);
  });

  it("costs no compound selector despite four combinations", () => {
    // The whole point of the palette/scheme split: the scheme block is
    // theme-independent because its values stay `var()` references.
    const sheet = resolverDocumentToCssTheme(loaded.document, {
      externalDocuments: loaded.externalDocuments,
    });
    expect(sheet.permutations).toHaveLength(4);
    expect(sheet.blocks.filter((b) => b.conditions.length > 1)).toEqual([]);
    expect(sheet.css).toContain("--color-background: var(--palette-background-light);");
  });

  it("honours the document's own selector mapping for the dark scheme", () => {
    const sheet = resolverDocumentToCssTheme(loaded.document, {
      externalDocuments: loaded.externalDocuments,
    });
    // System preference first, explicit attribute last so a manual toggle wins.
    expect(sheet.css).toContain("@media (prefers-color-scheme: dark)");
    expect(sheet.css.indexOf("@media (prefers-color-scheme: dark)")).toBeLessThan(
      sheet.css.indexOf(':root[data-color-scheme="dark"]'),
    );
  });

  it("keeps a value shared by both themes out of the theme block", () => {
    const sheet = resolverDocumentToCssTheme(loaded.document, {
      externalDocuments: loaded.externalDocuments,
    });
    const cosmos = sheet.blocks.find((b) => b.selector.includes("cosmos"))!;
    const properties = cosmos.declarations.map((d) => d.property);
    // Both palettes use #FFFFFF for the light surface, so it stays in :root.
    expect(properties).not.toContain("--palette-surface-light");
    expect(properties).toContain("--palette-background-light");
  });

  it("uses no legacy tic-tac-token.modes extension anywhere", () => {
    const json = JSON.stringify([loaded.document, loaded.externalDocuments]);
    expect(json).not.toContain("tic-tac-token.modes");
  });
});
