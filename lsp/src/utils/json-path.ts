import { findNodeAtLocation, type Node } from "jsonc-parser";

// arktype error paths arrive as `(string | number)[]`. jsonc-parser's
// `findNodeAtLocation` wants `JSONPath = (string | number)[]`. They're
// shape-compatible; this helper exists to keep callers from importing
// jsonc-parser internals just to traverse.
export type JsonPath = ReadonlyArray<string | number>;

export function nodeAtPath(root: Node | undefined, path: JsonPath): Node | undefined {
  if (!root) return undefined;
  return findNodeAtLocation(root, path as (string | number)[]);
}

// Resolve a Standard-Schema issue path (which may include PathSegment
// objects) into a plain string/number path.
export function normalizeIssuePath(
  path: ReadonlyArray<PropertyKey | { key: PropertyKey }> | undefined,
): JsonPath {
  if (!path) return [];
  const out: (string | number)[] = [];
  for (const seg of path) {
    const key = typeof seg === "object" && seg !== null && "key" in seg ? seg.key : seg;
    if (typeof key === "number") {
      out.push(key);
    } else if (typeof key === "string") {
      const asNum = Number(key);
      if (Number.isInteger(asNum) && String(asNum) === key) out.push(asNum);
      else out.push(key);
    }
  }
  return out;
}

// Given a token's dot-path (e.g. "color.brand.primary"), find the
// corresponding AST node. Walks the root by segment.
export function nodeForTokenPath(root: Node | undefined, tokenPath: string): Node | undefined {
  if (!root) return undefined;
  const segments = tokenPath.split(".");
  return findNodeAtLocation(root, segments);
}
