import { describe, expect, it } from "vitest";
import { Token } from "../src/index.ts";
import { isInvalid, isValid } from "./helpers.ts";

describe("$ref JSON Pointer token form (DTCG §7 + format/token.json)", () => {
  it("accepts a token with just $type and $ref", () => {
    expect(
      isValid(
        Token({
          $type: "color",
          $ref: "#/colors/primary/$value",
        }),
      ),
    ).toBe(true);
  });

  it("accepts a $ref without $type (target's type is authoritative)", () => {
    expect(
      isValid(Token({ $ref: "#/colors/primary/$value" })),
    ).toBe(true);
  });

  it("accepts $ref with sibling metadata", () => {
    expect(
      isValid(
        Token({
          $ref: "#/colors/primary/$value/components/0",
          $description: "aliased red channel",
          $deprecated: false,
        }),
      ),
    ).toBe(true);
  });

  it("rejects $ref that does not start with '#/'", () => {
    expect(isInvalid(Token({ $ref: "colors/primary/$value" }))).toBe(true);
    expect(isInvalid(Token({ $ref: "http://example.com/foo" }))).toBe(true);
  });

  it("rejects a token that supplies both $value and $ref (mutually exclusive)", () => {
    expect(
      isInvalid(
        Token({
          $type: "number",
          $value: 1,
          $ref: "#/nope",
        } as never),
      ),
    ).toBe(true);
  });

  it("rejects a $ref-token with a value-bearing unknown sibling key", () => {
    expect(
      isInvalid(
        Token({
          $ref: "#/colors/primary/$value",
          $surprise: 1,
        } as never),
      ),
    ).toBe(true);
  });
});
