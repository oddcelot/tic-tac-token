import { describe, expect, it } from "vitest";
import { Group, TokensFile } from "../src/index.ts";
import { isInvalid, isValid } from "./helpers.ts";

const colorToken = {
  $type: "color",
  $value: {
    colorSpace: "srgb",
    components: [1, 0, 0],
    alpha: 1,
    hex: "#ff0000",
  },
} as const;

const dimensionToken = {
  $type: "dimension",
  $value: { value: 16, unit: "px" },
} as const;

describe("Group (DTCG §5 + format/group.json)", () => {
  it("accepts an empty group", () => {
    expect(isValid(Group({}))).toBe(true);
  });

  it("accepts a flat group of tokens", () => {
    expect(
      isValid(
        Group({
          primary: colorToken,
          secondary: colorToken,
          base: dimensionToken,
        }),
      ),
    ).toBe(true);
  });

  it("accepts a deeply nested group (>= 3 levels)", () => {
    expect(
      isValid(
        Group({
          brand: {
            colors: {
              accent: {
                base: colorToken,
                hover: colorToken,
              },
            },
          },
        }),
      ),
    ).toBe(true);
  });

  it("accepts group-level $description and $extensions", () => {
    expect(
      isValid(
        Group({
          $description: "brand color palette",
          $extensions: { "acme.theme": { light: true } },
          primary: colorToken,
        }),
      ),
    ).toBe(true);
  });

  it("accepts a group-level $type (inherited by child tokens conceptually)", () => {
    expect(
      isValid(
        Group({
          $type: "color",
          primary: colorToken,
        }),
      ),
    ).toBe(true);
  });

  it("rejects a group $type that is not a DTCG token-type name", () => {
    expect(isInvalid(Group({ $type: "not-a-real-type" }))).toBe(true);
  });

  it("accepts $extends as a curly-brace reference", () => {
    expect(
      isValid(
        Group({
          $extends: "{base.colors}",
          accent: colorToken,
        }),
      ),
    ).toBe(true);
  });

  it("rejects $extends that is not a valid alias", () => {
    expect(isInvalid(Group({ $extends: "base.colors" }))).toBe(true);
    expect(isInvalid(Group({ $extends: "{}" }))).toBe(true);
  });

  it("accepts a $root token on a group", () => {
    expect(
      isValid(
        Group({
          $root: colorToken,
          accent: colorToken,
        }),
      ),
    ).toBe(true);
  });

  it("rejects a $root that is not a valid token", () => {
    expect(
      isInvalid(
        Group({
          $root: { notAToken: true } as never,
        }),
      ),
    ).toBe(true);
  });

  it("accepts $deprecated as boolean or string on a group", () => {
    expect(isValid(Group({ $deprecated: true }))).toBe(true);
    expect(
      isValid(Group({ $deprecated: "use new-palette instead" })),
    ).toBe(true);
  });

  it("rejects an unknown $-prefixed key on a group", () => {
    expect(
      isInvalid(Group({ $unknown: "nope" } as never)),
    ).toBe(true);
  });

  it("rejects a child name starting with $", () => {
    expect(
      isInvalid(Group({ $secret: colorToken } as never)),
    ).toBe(true);
  });

  it("rejects a child name containing '.'", () => {
    expect(
      isInvalid(Group({ "foo.bar": colorToken } as never)),
    ).toBe(true);
  });

  it("rejects a child name containing '{' or '}'", () => {
    expect(
      isInvalid(Group({ "foo{bar": colorToken } as never)),
    ).toBe(true);
    expect(
      isInvalid(Group({ "foo}bar": colorToken } as never)),
    ).toBe(true);
  });
});

describe("TokensFile (root document)", () => {
  it("accepts a root document that mixes tokens, groups, and metadata", () => {
    expect(
      isValid(
        TokensFile({
          $description: "Design tokens for acme",
          colors: {
            $type: "color",
            primary: colorToken,
            secondary: colorToken,
            semantic: {
              error: colorToken,
            },
          },
          sizing: {
            base: dimensionToken,
          },
        }),
      ),
    ).toBe(true);
  });
});
