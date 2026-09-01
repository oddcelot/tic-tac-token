import { jsonPointerGet } from "./json-pointer.ts";
import type { ResolverError } from "./types.ts";

// Resolve every `{ "$ref": "#/..." }` object and every token-root `$ref`
// (a token that uses `$ref` in place of `$value`) by replacing it with
// the target's value. Walks the whole document so refs nested inside any
// composite sub-value are resolved.
//
// Two forms per DTCG 2025.10 §4.2:
//   1. Token-root: { $type, $ref } — the ref replaces $value.
//   2. Nested:     { $ref } anywhere a primitive or composite sub-value is
//                  expected — the ref object is replaced by the target.
//
// Cycles are detected via a visited-pointer set and reported via the
// `errors` collector; the unresolved `$ref` object is left in place so
// downstream consumers can surface it. Unresolvable pointers (target
// missing) are likewise reported and left in place.
//
// `path` accumulates the dot-joined location (including array indices)
// from the document root; it's used as the `at` field on emitted
// errors so the LSP diagnostics handler can map back to a source range.
export function resolveRefs(
  node: unknown,
  root: unknown,
  errors: ResolverError[] = [],
  path: ReadonlyArray<string | number> = [],
  stack: Set<string> = new Set(),
): unknown {
  if (Array.isArray(node)) {
    return node.map((item, i) => resolveRefs(item, root, errors, [...path, i], stack));
  }
  if (!node || typeof node !== "object") return node;

  const rec = node as Record<string, unknown>;

  if (typeof rec.$ref === "string") {
    const onlyRef = Object.keys(rec).every((k) => k === "$ref");
    const tokenRootRef =
      "$type" in rec && !("$value" in rec) && typeof rec.$type === "string";

    if (onlyRef || tokenRootRef) {
      const at = path.length > 0 ? path.join(".") : "(root)";
      if (stack.has(rec.$ref)) {
        errors.push({
          kind: "ref-cycle",
          at,
          message: `$ref cycle detected through ${rec.$ref}.`,
        });
        return node;
      }
      const target = jsonPointerGet(root, rec.$ref);
      if (target === undefined) {
        errors.push({
          kind: "broken-ref",
          at,
          message: `$ref ${rec.$ref} does not resolve to a value in this document.`,
          target: rec.$ref,
        });
        return node;
      }
      const next = new Set(stack);
      next.add(rec.$ref);
      const resolvedTarget = resolveRefs(target, root, errors, path, next);
      if (onlyRef) return resolvedTarget;
      return { ...rec, $value: resolvedTarget };
    }
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rec)) {
    out[k] = resolveRefs(v, root, errors, [...path, k], stack);
  }
  return out;
}
