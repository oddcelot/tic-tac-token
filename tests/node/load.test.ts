import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  loadResolverDocument,
  loadResolverDocumentSync,
} from "../../src/node/load.ts";
import { resolverDocumentToCssTheme } from "../../src/css.ts";
import { resolveResolverDocument } from "../../src/resolver-module/index.ts";

const fixture = (name: string) =>
  fileURLToPath(new URL(`../fixtures/resolver/${name}`, import.meta.url));

describe("loadResolverDocumentSync", () => {
  it("reads the entry document and every referenced file", () => {
    const loaded = loadResolverDocumentSync(fixture("resolver.json"));

    expect(loaded.errors).toEqual([]);
    expect((loaded.document as { version: string }).version).toBe("2025.10");
    expect(Object.keys(loaded.externalDocuments).sort()).toEqual([
      "tokens/base.json",
      "tokens/themes/dark.json",
      "tokens/themes/light.json",
    ]);
  });

  it("keys externals by the raw URI, exactly as resolveResolverDocument expects", () => {
    const loaded = loadResolverDocumentSync(fixture("resolver.json"));
    const result = resolveResolverDocument(loaded.document, { theme: "dark" }, {
      externalDocuments: loaded.externalDocuments,
    });

    expect(result.documentErrors).toEqual([]);
    expect(result.tokens.byPath.get("color.bg")?.$value).toMatchObject({ hex: "#000000" });
    expect(result.tokens.byPath.get("size.md")?.$value).toMatchObject({ value: 16 });
  });

  it("feeds the CSS theme emitter end to end", () => {
    const loaded = loadResolverDocumentSync(fixture("resolver.json"));
    const sheet = resolverDocumentToCssTheme(loaded.document, {
      externalDocuments: loaded.externalDocuments,
    });

    expect(sheet.documentErrors).toEqual([]);
    expect(sheet.css).toContain("--color-bg: #ffffff;");
    expect(sheet.css).toContain('[data-theme="dark"]');
    expect(sheet.css).toContain("--color-bg: #000000;");
  });

  it("resolves relative to the entry file, not the process cwd", () => {
    // The fixture writes `tokens/base.json`, which only resolves when the base
    // directory is the entry's own.
    const loaded = loadResolverDocumentSync(fixture("resolver.json"));
    expect(loaded.externalDocuments["tokens/base.json"]).toBeDefined();
    expect(loaded.path.endsWith("resolver.json")).toBe(true);
  });

  it("accepts a relative entry path", () => {
    const loaded = loadResolverDocumentSync("tests/fixtures/resolver/resolver.json");
    expect(loaded.errors).toEqual([]);
    expect(Object.keys(loaded.externalDocuments)).toHaveLength(3);
  });

  it("reports a missing referenced file without throwing", () => {
    const loaded = loadResolverDocumentSync(fixture("missing-ref.json"));
    expect(loaded.document).toBeDefined();
    expect(loaded.errors).toHaveLength(1);
    expect(loaded.errors[0]?.target).toBe("tokens/nope.json");
    expect(loaded.errors[0]?.message).toContain("Could not read");
  });

  it("reports a missing entry file without throwing", () => {
    const loaded = loadResolverDocumentSync(fixture("does-not-exist.json"));
    expect(loaded.document).toBeUndefined();
    expect(loaded.externalDocuments).toEqual({});
    expect(loaded.errors[0]?.message).toContain("Could not read");
  });

  it("reports malformed JSON without throwing", () => {
    const loaded = loadResolverDocumentSync(fixture("malformed.json"));
    expect(loaded.document).toBeUndefined();
    expect(loaded.errors[0]?.message).toContain("not valid JSON");
  });

  it("refuses to fetch a remote reference and says how to supply it", () => {
    const loaded = loadResolverDocumentSync(fixture("remote-ref.json"));
    expect(loaded.errors).toHaveLength(1);
    expect(loaded.errors[0]?.target).toBe("https://example.com/t.json");
    expect(loaded.errors[0]?.message).toContain("externalDocuments");
  });

  it("diagnoses a nested relative reference, whose base is ambiguous", () => {
    // `nested/inner/mid.json` writes `./leaf.json`. That reads as "next to
    // mid.json", but the flat externalDocuments key forces it to resolve from
    // the entry's directory instead — so it is reported rather than silently
    // pointing somewhere else.
    const loaded = loadResolverDocumentSync(fixture("nested/entry.json"));
    const nested = loaded.errors.find((e) => e.target === "./leaf.json");
    expect(nested).toBeDefined();
    expect(nested?.at).toBe("inner/mid.json");
    expect(nested?.message).toContain("resolved against the entry document's directory");
  });

  it("does not revisit a document referenced twice", () => {
    const loaded = loadResolverDocumentSync(fixture("resolver.json"));
    expect(Object.keys(loaded.externalDocuments)).toHaveLength(3);
  });
});

describe("loadResolverDocument (async)", () => {
  it("produces the same result as the sync loader", async () => {
    const sync = loadResolverDocumentSync(fixture("resolver.json"));
    const async = await loadResolverDocument(fixture("resolver.json"));

    expect(async.path).toBe(sync.path);
    expect(async.document).toEqual(sync.document);
    expect(async.externalDocuments).toEqual(sync.externalDocuments);
    expect(async.errors).toEqual(sync.errors);
  });

  it("reports the same diagnostics as the sync loader", async () => {
    for (const name of ["missing-ref.json", "malformed.json", "remote-ref.json", "nested/entry.json"]) {
      const sync = loadResolverDocumentSync(fixture(name));
      const async = await loadResolverDocument(fixture(name));
      expect(async.errors, name).toEqual(sync.errors);
      expect(async.externalDocuments, name).toEqual(sync.externalDocuments);
    }
  });

  it("terminates on a document that references nothing", async () => {
    const loaded = await loadResolverDocument(fixture("tokens/base.json"));
    expect(loaded.errors).toEqual([]);
    expect(loaded.externalDocuments).toEqual({});
  });
});
