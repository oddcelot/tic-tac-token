import { resolveAliases } from "./aliases.ts";
import { clampGradients } from "./clamp.ts";
import { applyExtends } from "./extends.ts";
import { flattenTokens } from "./flatten.ts";
import { resolveRefs } from "./refs.ts";
import type { FlatToken, ResolvedTokens, ResolverError } from "./types.ts";
import { validateValues } from "./validate.ts";

export { jsonPointerGet } from "./json-pointer.ts";
export { resolveRefs } from "./refs.ts";
export { applyExtends } from "./extends.ts";
export { flattenTokens } from "./flatten.ts";
export { resolveAliases, aliasTarget } from "./aliases.ts";
export { clampGradients } from "./clamp.ts";
export { validateValues } from "./validate.ts";
export type {
  TokenType,
  FlatToken,
  ResolverError,
  ResolverErrorKind,
  ResolvedTokens,
} from "./types.ts";
export { TOKEN_TYPES, isTokenType } from "./types.ts";

// Run the full DTCG resolver pipeline against a parsed tokens document.
//
//   1. Apply `$extends` deep-merge inheritance at the group level.
//   2. Dereference `$ref` objects (token-root + nested forms).
//   3. Flatten the tree with group-`$type` inheritance.
//   4. Validate inherited-type tokens' $values against their type's
//      shape (explicit-type tokens are covered by the Token schema).
//   5. Resolve `{alias}` curly-brace strings to target $values.
//   6. Clamp `gradient.position` numbers to [0, 1].
//
// The orchestrator returns the flattened token list, a path-indexed
// map, a reverse-reference graph, and the cumulative error list. None
// of the input is mutated.
export function resolveTokens(root: unknown): ResolvedTokens {
  const { result: merged, errors: extendsErrors } = applyExtends(root);
  const refErrors: ResolverError[] = [];
  const dereffed = resolveRefs(merged, merged, refErrors);
  const { tokens: flat, errors: flattenErrors } = flattenTokens(dereffed);
  const valueErrors = validateValues(flat);

  const byPath = new Map<string, FlatToken>(flat.map((t) => [t.path, t]));
  const references = new Map<string, Set<string>>();
  const aliasErrors: ResolverError[] = [];
  const aliased = resolveAliases(flat, byPath, references, aliasErrors);

  const clamped = clampGradients(aliased);
  const clampedByPath = new Map(clamped.map((t) => [t.path, t]));

  return {
    tokens: clamped,
    byPath: clampedByPath,
    errors: [
      ...extendsErrors,
      ...refErrors,
      ...flattenErrors,
      ...valueErrors,
      ...aliasErrors,
    ],
    references,
  };
}
