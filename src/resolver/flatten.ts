import { type FlatToken, isTokenType, type ResolverError } from "./types.ts";

const MODES_KEY = "tic-tac-token.modes";

// Walk the token tree. A node is a token iff it carries `$value` (per
// DTCG 2025.10 §2). All other objects with non-`$`-prefixed children are
// groups. Tokens inherit `$type` from the nearest ancestor group when
// they don't declare their own (DTCG §3 type-resolution rules).
//
// Returns the flat list and any inheritance errors (a token that ends up
// without a resolvable $type after walking).
export function flattenTokens(root: unknown): {
  tokens: FlatToken[];
  errors: ResolverError[];
} {
  const tokens: FlatToken[] = [];
  const errors: ResolverError[] = [];

  function walk(node: unknown, prefix: string[], inheritedType: string | undefined): void {
    if (!node || typeof node !== "object" || Array.isArray(node)) return;
    const rec = node as Record<string, unknown>;

    const localType = typeof rec.$type === "string" ? rec.$type : undefined;
    const effectiveType = localType ?? inheritedType;

    if ("$value" in rec) {
      const path = prefix.join(".");
      if (!effectiveType) {
        errors.push({
          kind: "type-mismatch",
          at: path || "(root)",
          message: "Token has no $type and no inherited group $type.",
        });
        return;
      }
      if (!isTokenType(effectiveType)) {
        errors.push({
          kind: "type-mismatch",
          at: path || "(root)",
          message: `Unknown $type "${effectiveType}".`,
        });
        return;
      }
      const shared = {
        $type: effectiveType as import("./types.ts").TokenType,
        $description:
          typeof rec.$description === "string" ? rec.$description : undefined,
        $deprecated:
          typeof rec.$deprecated === "boolean" ||
          typeof rec.$deprecated === "string"
            ? (rec.$deprecated as boolean | string)
            : undefined,
      } as const;

      tokens.push({
        path,
        ...shared,
        typeInherited: localType === undefined,
        $value: rec.$value,
        $extensions:
          rec.$extensions && typeof rec.$extensions === "object"
            ? (rec.$extensions as Record<string, unknown>)
            : undefined,
      });

      // Expand `$extensions.tic-tac-token.modes` into separate tokens.
      const ext = rec.$extensions;
      if (ext && typeof ext === "object" && !Array.isArray(ext)) {
        const modes = (ext as Record<string, unknown>)[MODES_KEY];
        if (modes && typeof modes === "object" && !Array.isArray(modes)) {
          for (const [modeName, modeValue] of Object.entries(modes as Record<string, unknown>)) {
            tokens.push({
              path: `${path}@${modeName}`,
              ...shared,
              typeInherited: true,
              mode: modeName,
              $value: modeValue,
            });
          }
        }
      }
      return;
    }

    for (const [k, v] of Object.entries(rec)) {
      if (k.startsWith("$")) continue;
      walk(v, [...prefix, k], effectiveType);
    }
  }

  walk(root, [], undefined);
  return { tokens, errors };
}
