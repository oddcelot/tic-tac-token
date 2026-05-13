import { jsonPointerGet } from "./json-pointer.ts";

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
// Cycles are detected via a visited-pointer set; on cycle the original
// `$ref` object is left in place so callers can surface it as an error.
// Unresolvable pointers are likewise left in place.
export function resolveRefs(
  node: unknown,
  root: unknown,
  stack: Set<string> = new Set(),
): unknown {
  if (Array.isArray(node)) {
    return node.map((item) => resolveRefs(item, root, stack));
  }
  if (!node || typeof node !== "object") return node;

  const rec = node as Record<string, unknown>;

  if (typeof rec.$ref === "string") {
    const onlyRef = Object.keys(rec).every((k) => k === "$ref");
    const tokenRootRef =
      "$type" in rec && !("$value" in rec) && typeof rec.$type === "string";

    if (onlyRef) {
      if (stack.has(rec.$ref)) return node;
      const target = jsonPointerGet(root, rec.$ref);
      if (target === undefined) return node;
      const next = new Set(stack);
      next.add(rec.$ref);
      return resolveRefs(target, root, next);
    }

    if (tokenRootRef) {
      if (stack.has(rec.$ref)) return node;
      const target = jsonPointerGet(root, rec.$ref);
      if (target === undefined) return node;
      const next = new Set(stack);
      next.add(rec.$ref);
      const resolvedTarget = resolveRefs(target, root, next);
      return { ...rec, $value: resolvedTarget };
    }
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rec)) {
    out[k] = resolveRefs(v, root, stack);
  }
  return out;
}
