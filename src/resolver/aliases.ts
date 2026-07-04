import type { FlatToken, ResolverError } from "./types.ts";

// `{group.token}` curly-brace reference. Whole-string only — embedded
// aliases inside a value object (e.g. an alias used as one channel of a
// color) are matched against this same regex per sub-property as the
// caller walks the structure. See `resolveAliasValue` below.
const ALIAS_RE = /^\{([^{}]+)\}$/;

export function aliasTarget(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const match = value.match(ALIAS_RE);
  return match?.[1];
}

// Resolve curly-brace alias strings to the target's `$value`. Walks each
// token's $value and recursively replaces any `"{...}"` string with the
// referenced token's value (resolving transitively). Cycles are detected
// and reported; the alias string is left in place on cycle so downstream
// callers can surface the issue without crashing.
//
// `references` is populated with the inverse index: for each resolved
// alias source → target, record `source` under `target`'s entry. Used by
// the LSP find-references handler.
export function resolveAliases(
  tokens: FlatToken[],
  byPath: Map<string, FlatToken>,
  references: Map<string, Set<string>>,
  errors: ResolverError[],
): FlatToken[] {
  const cache = new Map<string, unknown>();

  function resolveValue(value: unknown, originPath: string, stack: Set<string>): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => resolveValue(item, originPath, stack));
    }
    if (value && typeof value === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        out[k] = resolveValue(v, originPath, stack);
      }
      return out;
    }

    const target = aliasTarget(value);
    if (!target) return value;

    if (stack.has(target)) {
      errors.push({
        kind: "alias-cycle",
        at: originPath,
        message: `Alias cycle detected through "{${target}}".`,
        target,
      });
      return value;
    }

    const referencedFrom = references.get(target) ?? new Set<string>();
    referencedFrom.add(originPath);
    references.set(target, referencedFrom);

    const targetToken = byPath.get(target);
    if (!targetToken) {
      errors.push({
        kind: "broken-alias",
        at: originPath,
        message: `Alias "{${target}}" does not resolve to a known token.`,
        target,
      });
      return value;
    }

    const cached = cache.get(target);
    if (cached !== undefined) return cached;

    const nextStack = new Set(stack);
    nextStack.add(target);
    const resolved = resolveValue(targetToken.$value, target, nextStack);
    cache.set(target, resolved);
    return resolved;
  }

  return tokens.map((t) => ({
    ...t,
    $value: resolveValue(t.$value, t.path, new Set([t.path])),
  }));
}
