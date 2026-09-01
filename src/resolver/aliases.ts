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
  // Chains are re-walked from every token that enters them, so the same
  // hop can be visited more than once; report each origin/target pair once.
  const reportedMismatches = new Set<string>();

  // `isWholeValue` marks the calls where the alias being resolved is the
  // token's entire `$value` (the outermost call, and each hop into a
  // target's own `$value`). Only there is a straight `$type` comparison
  // meaningful — an alias embedded in a composite sub-value (a gradient
  // stop's colour, a shadow layer) legitimately targets a different type
  // than the composite that contains it.
  function resolveValue(
    value: unknown,
    originPath: string,
    stack: Set<string>,
    isWholeValue = false,
  ): unknown {
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

    // DTCG 2025.10 format §7.4.5/§7.5.3 + resolver §6.3: an alias must
    // point at a token of the referencing token's type. Checked before the
    // cache lookup so every call site gets its own diagnostic — the cache
    // memoises resolved values, not errors.
    if (isWholeValue) {
      const originType = byPath.get(originPath)?.$type;
      const mismatchKey = `${originPath}\u0000${target}`;
      if (
        originType &&
        originType !== targetToken.$type &&
        !reportedMismatches.has(mismatchKey)
      ) {
        reportedMismatches.add(mismatchKey);
        errors.push({
          kind: "type-mismatch",
          at: originPath,
          message: `Alias "{${target}}" targets a "${targetToken.$type}" token, but "${originPath}" is typed "${originType}".`,
          target,
        });
      }
    }

    const cached = cache.get(target);
    if (cached !== undefined) return cached;

    const nextStack = new Set(stack);
    nextStack.add(target);
    const resolved = resolveValue(targetToken.$value, target, nextStack, true);
    cache.set(target, resolved);
    return resolved;
  }

  return tokens.map((t) => ({
    ...t,
    $value: resolveValue(t.$value, t.path, new Set([t.path]), true),
  }));
}
