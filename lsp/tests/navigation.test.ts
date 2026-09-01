import { describe, expect, it } from "vitest";
import { analyze } from "../src/analyzer.ts";
import { definitionAt, referencesAt } from "../src/handlers/navigation.ts";
import { WorkspaceIndex } from "../src/workspace/index.ts";
import { lineCharOf } from "./helpers.ts";

const URI = "file:///theme.tokens.json";

const TEXT = JSON.stringify(
  {
    color: {
      $type: "color",
      primary: {
        $value: {
          colorSpace: "srgb",
          components: [1, 0, 0],
          alpha: 1,
          hex: "#ff0000",
        },
      },
      accent: { $value: "{color.primary}" },
      aliasRef: {
        $type: "color",
        $ref: "#/color/primary/$value",
      },
    },
  },
  null,
  2,
);

// A document that references color.primary but does NOT define it —
// used to force the cross-file code path through the workspace index.
const USAGE_TEXT = JSON.stringify(
  {
    color: {
      accent: { $type: "color", $value: "{color.primary}" },
    },
  },
  null,
  2,
);

const BASE_TEXT = JSON.stringify(
  {
    color: {
      $type: "color",
      primary: {
        $value: { colorSpace: "srgb", components: [1, 0, 0], hex: "#ff0000" },
      },
    },
  },
  null,
  2,
);

describe("definitionAt", () => {
  it("jumps from an alias to its target token key", async () => {
    const analysis = await analyze(TEXT);
    const location = definitionAt(analysis, lineCharOf(TEXT, '"{color.primary}"'), undefined, URI);
    expect(location).toBeDefined();
    expect(location!.uri).toBe(URI);
    // The definition is the `"primary"` key of the target token.
    const expectedStart = lineCharOf(TEXT, '"primary"');
    expect(location!.range.start).toEqual(expectedStart);
  });

  it("jumps from a $ref pointer to its target token key", async () => {
    const analysis = await analyze(TEXT);
    const location = definitionAt(
      analysis,
      lineCharOf(TEXT, '"#/color/primary/$value"'),
      undefined,
      URI,
    );
    expect(location).toBeDefined();
    expect(location!.range.start).toEqual(lineCharOf(TEXT, '"primary"'));
  });

  it("resolves an alias across files via the workspace index", async () => {
    // Base file defines color.primary; usage file aliases it.
    const baseAnalysis = await analyze(BASE_TEXT);
    const baseUri = "file:///base.tokens.json";
    const index = new WorkspaceIndex();
    index.upsert(baseUri, baseAnalysis);

    const usage = await analyze(USAGE_TEXT);
    const location = definitionAt(
      usage,
      lineCharOf(USAGE_TEXT, '"{color.primary}"'),
      index,
      URI,
    );
    expect(location).toBeDefined();
    expect(location!.uri).toBe(baseUri);
    expect(location!.range.start).toEqual(lineCharOf(BASE_TEXT, '"primary"'));
  });

  it("returns undefined on a token key (no reference under the cursor)", async () => {
    const analysis = await analyze(TEXT);
    const location = definitionAt(analysis, lineCharOf(TEXT, '"accent"'), undefined, URI);
    expect(location).toBeUndefined();
  });
});

describe("referencesAt", () => {
  it("finds the definition and all aliases referencing a token", async () => {
    const analysis = await analyze(TEXT);
    const locations = referencesAt(analysis, lineCharOf(TEXT, '"primary"'), undefined, URI);

    // Definition of color.primary…
    expect(locations.some((l) => l.range.start.line === lineCharOf(TEXT, '"primary"').line)).toBe(true);
    // …the alias usage in color.accent's $value…
    const aliasPos = lineCharOf(TEXT, '"{color.primary}"');
    expect(locations.some((l) => l.range.start.line === aliasPos.line)).toBe(true);
    // …and the $ref pointer (its range contains the pointer string).
    const refPos = lineCharOf(TEXT, '"#/color/primary/$value"');
    expect(locations.some((l) => l.range.start.line === refPos.line)).toBe(true);
  });

  it("treats the cursor on an alias the same as on the definition", async () => {
    const analysis = await analyze(TEXT);
    const fromAlias = referencesAt(analysis, lineCharOf(TEXT, '"{color.primary}"'), undefined, URI);
    const fromDef = referencesAt(analysis, lineCharOf(TEXT, '"primary"'), undefined, URI);
    expect(fromAlias.length).toBe(fromDef.length);
    expect(fromAlias.map((l) => JSON.stringify(l))).toEqual(
      fromDef.map((l) => JSON.stringify(l)),
    );
  });

  it("finds cross-file references via the workspace index", async () => {
    const baseAnalysis = await analyze(BASE_TEXT);
    const index = new WorkspaceIndex();
    const baseUri = "file:///base.tokens.json";
    index.upsert(baseUri, baseAnalysis);

    const usage = await analyze(USAGE_TEXT);
    const baseDefLine = lineCharOf(BASE_TEXT, '"primary"').line;
    const locations = referencesAt(usage, lineCharOf(USAGE_TEXT, '"{color.primary}"'), index, URI);
    const baseDef = locations.find((l) => l.uri === baseUri);
    expect(baseDef).toBeDefined();
    expect(baseDef!.range.start.line).toBe(baseDefLine);
    // The reference itself resolves to the current file's alias string.
    expect(locations.some((l) => l.uri === URI)).toBe(true);
  });

  it("returns [] when the cursor is outside any token", async () => {
    const analysis = await analyze(TEXT);
    expect(referencesAt(analysis, { line: 0, character: 0 }, undefined, URI)).toEqual([]);
  });
});