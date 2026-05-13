import type { ResolverError } from "./types.ts";

// Curly-brace path used by `$extends`. Like the alias form, but the
// target MUST be a group (no `$value`). The exact constraint is enforced
// at use-time below.
const EXTENDS_RE = /^\{([^{}]+)\}$/;

// Walk a group path (dot-separated) from the root. Returns the
// referenced group node or `undefined` if any segment misses.
function groupAt(root: unknown, path: string[]): unknown {
  let cur: unknown = root;
  for (const seg of path) {
    if (!cur || typeof cur !== "object" || Array.isArray(cur)) return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

// Deep-merge: `base` provides the inherited shape; `over` provides local
// overrides. Per DTCG 2025.10 §4.3, tokens defined locally completely
// replace inherited ones — only group-level keys deep-merge.
//
// A "token" here is detected by the presence of `$value` OR `$ref` at
// that path. We do not recurse into tokens; the local definition wins
// wholesale.
function deepMergeGroup(
  base: Record<string, unknown>,
  over: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [k, overVal] of Object.entries(over)) {
    if (k === "$extends") continue;
    const baseVal = out[k];
    if (isPlainObject(baseVal) && isPlainObject(overVal)) {
      const overIsToken = "$value" in overVal || "$ref" in overVal;
      const baseIsToken = "$value" in baseVal || "$ref" in baseVal;
      if (overIsToken || baseIsToken) {
        out[k] = overVal;
      } else {
        out[k] = deepMergeGroup(baseVal, overVal);
      }
    } else {
      out[k] = overVal;
    }
  }
  return out;
}

// Resolve every group-level `$extends` by deep-merging the referenced
// group into the extending one. Returns a new tree; the input is not
// mutated. Cycles are reported as errors and the `$extends` reference is
// left in place (no merge happens for that group).
//
// `$extends` MUST point at a group via `{path.to.group}` syntax. If the
// target doesn't resolve to a group (or doesn't exist), an error is
// recorded and the extending group is returned unchanged.
export function applyExtends(root: unknown): {
  result: unknown;
  errors: ResolverError[];
} {
  const errors: ResolverError[] = [];

  function resolve(
    node: unknown,
    pathFromRoot: string[],
    stack: Set<string>,
  ): unknown {
    if (Array.isArray(node)) {
      return node.map((item, i) => resolve(item, [...pathFromRoot, String(i)], stack));
    }
    if (!isPlainObject(node)) return node;
    if ("$value" in node || "$ref" in node) return node;

    let current: Record<string, unknown> = node;
    const extendsRef = current.$extends;

    if (typeof extendsRef === "string") {
      const match = extendsRef.match(EXTENDS_RE);
      const targetPath = match?.[1];
      const here = pathFromRoot.join(".");

      if (!targetPath) {
        errors.push({
          kind: "broken-extends",
          at: here || "(root)",
          message: `$extends must be a curly-brace group ref; got ${JSON.stringify(extendsRef)}.`,
        });
      } else if (stack.has(targetPath)) {
        errors.push({
          kind: "extends-cycle",
          at: here || "(root)",
          message: `$extends cycle detected through {${targetPath}}.`,
        });
      } else {
        const targetNode = groupAt(root, targetPath.split("."));
        if (!isPlainObject(targetNode)) {
          errors.push({
            kind: "broken-extends",
            at: here || "(root)",
            message: `$extends target {${targetPath}} does not resolve to a group.`,
          });
        } else if ("$value" in targetNode || "$ref" in targetNode) {
          errors.push({
            kind: "broken-extends",
            at: here || "(root)",
            message: `$extends target {${targetPath}} resolves to a token, not a group.`,
          });
        } else {
          // Resolve the parent first (cycles guarded), then merge.
          const nextStack = new Set(stack);
          nextStack.add(here);
          const resolvedParent = resolve(targetNode, targetPath.split("."), nextStack);
          if (isPlainObject(resolvedParent)) {
            current = deepMergeGroup(resolvedParent, current);
          }
        }
      }
    }

    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(current)) {
      if (k === "$extends") continue;
      out[k] = resolve(v, [...pathFromRoot, k], stack);
    }
    return out;
  }

  return { result: resolve(root, [], new Set()), errors };
}
