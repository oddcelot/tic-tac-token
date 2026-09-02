// RFC 6901 JSON Pointer dereference. A pointer like `#/a/b/0` walks the
// root object by segments. `~1` decodes to `/`, `~0` to `~` (per spec).
// Returns `undefined` for any miss (unknown segment, type mismatch, array
// index out of range, or malformed pointer prefix).
//
// DTCG 2025.10 §4.2 anchors $ref values at `#/...`; we enforce that
// prefix here so a relative or schema-less ref fails fast.
export function jsonPointerSegments(pointer: string): string[] | undefined {
  if (!pointer.startsWith("#/")) return undefined;
  return pointer
    .slice(2)
    .split("/")
    .map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"));
}

export function jsonPointerGet(root: unknown, pointer: string): unknown {
  const segments = jsonPointerSegments(pointer);
  if (!segments) return undefined;
  let cur: unknown = root;
  for (const seg of segments) {
    if (cur == null) return undefined;
    if (Array.isArray(cur)) {
      const i = Number(seg);
      if (!Number.isInteger(i)) return undefined;
      cur = cur[i];
    } else if (typeof cur === "object") {
      cur = (cur as Record<string, unknown>)[seg];
    } else {
      return undefined;
    }
  }
  return cur;
}
