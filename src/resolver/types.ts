// The 13 DTCG 2025.10 type strings. Mirrors the TokenTypeName arktype
// union in src/token.ts but exported as a discrete string-literal union
// for resolver consumers that need a closed enum at the type level.
export type TokenType =
  | "color"
  | "dimension"
  | "fontFamily"
  | "fontWeight"
  | "duration"
  | "cubicBezier"
  | "number"
  | "strokeStyle"
  | "border"
  | "transition"
  | "shadow"
  | "gradient"
  | "typography";

export const TOKEN_TYPES = [
  "color",
  "dimension",
  "fontFamily",
  "fontWeight",
  "duration",
  "cubicBezier",
  "number",
  "strokeStyle",
  "border",
  "transition",
  "shadow",
  "gradient",
  "typography",
] as const satisfies readonly TokenType[];

export function isTokenType(value: unknown): value is TokenType {
  return (
    typeof value === "string" && (TOKEN_TYPES as readonly string[]).includes(value)
  );
}

export type FlatToken = {
  /** Dot-joined path from the document root, e.g. `"color.brand.primary"`. */
  path: string;
  $type: TokenType;
  /**
   * True when `$type` came from an ancestor group rather than the token
   * itself. Tokens with an explicit `$type` are shape-validated by the
   * Token schema; inherited-type tokens are validated by the resolver's
   * `validateValues` pass instead.
   */
  typeInherited: boolean;
  $value: unknown;
  $description?: string;
  $extensions?: Record<string, unknown>;
  $deprecated?: boolean | string;
};

export type ResolverErrorKind =
  | "broken-ref"
  | "broken-alias"
  | "ref-cycle"
  | "alias-cycle"
  | "extends-cycle"
  | "broken-extends"
  | "type-mismatch"
  | "invalid-value";

export type ResolverError = {
  kind: ResolverErrorKind;
  /** Token path or pointer that surfaced the error. */
  at: string;
  message: string;
};

export type ResolvedTokens = {
  tokens: FlatToken[];
  byPath: Map<string, FlatToken>;
  errors: ResolverError[];
  /** For each token path, the set of paths whose `$value` references it. */
  references: Map<string, Set<string>>;
};
