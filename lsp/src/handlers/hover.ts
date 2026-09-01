import type { FlatToken } from "@oddsquad/tic-tac-token/resolver";
import { aliasTarget, flattenTokens, isTokenType } from "@oddsquad/tic-tac-token/resolver";
import { findNodeAtLocation, type Node } from "jsonc-parser";
import { type Hover, MarkupKind, type Position } from "vscode-languageserver";
import type { AnalysisResult } from "../analyzer.ts";
import { renderTokenHover } from "../utils/hover-markdown.ts";
import { nodeRange, positionToOffset } from "../utils/positions.ts";
import type { WorkspaceIndex } from "../workspace/index.ts";

// Walk up the ancestor chain in the AST to find the nearest enclosing
// "token" node — an object that has a `$value` or `$ref` property.
// Returns the token node and its dot-path from the document root.
export function findEnclosingToken(
  root: Node | undefined,
  offset: number,
): { node: Node; path: string } | undefined {
  if (!root) return undefined;

  function visit(
    node: Node,
    prefix: string[],
    start = node.offset,
    end = node.offset + node.length,
  ): { node: Node; path: string } | undefined {
    if (offset < start || offset > end) return undefined;

    if (node.type === "object" && node.children) {
      const isToken = node.children.some(
        (pair) =>
          pair.children?.[0]?.value === "$value" ||
          pair.children?.[0]?.value === "$ref",
      );
      // Recurse into plain-key properties first to find the deepest match.
      // The whole property (key + value) counts as enclosing, so a cursor
      // on a token's *name* still resolves to that token.
      for (const pair of node.children) {
        const key = pair.children?.[0]?.value;
        const child = pair.children?.[1];
        if (typeof key === "string" && !key.startsWith("$") && child) {
          const deeper = visit(
            child,
            [...prefix, key],
            pair.offset,
            pair.offset + pair.length,
          );
          if (deeper) return deeper;
        }
      }
      if (isToken) return { node, path: prefix.join(".") };
    }
    return undefined;
  }

  return visit(root, []);
}

// Read the raw token object at a dot-path from a parsed JSON tree.
// Returns undefined if any path segment misses or lands on a non-object.
function rawTokenAt(
  root: unknown,
  path: string,
): Record<string, unknown> | undefined {
  if (!root || typeof root !== "object") return undefined;
  let cur: unknown = root;
  for (const seg of path.split(".")) {
    if (!cur || typeof cur !== "object" || Array.isArray(cur)) return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur && typeof cur === "object" && !Array.isArray(cur)
    ? (cur as Record<string, unknown>)
    : undefined;
}

// Find the deepest node in the AST that contains `offset`.
function deepestNodeAt(root: Node, offset: number): Node {
  function visit(n: Node): Node {
    if (!n.children) return n;
    for (const child of n.children) {
      if (offset >= child.offset && offset <= child.offset + child.length) {
        return visit(child);
      }
    }
    return n;
  }
  return visit(root);
}

// Walk up from a node collecting property-key breadcrumbs.
// Returns keys from root to the node's parent property.
function propertyPath(node: Node): string[] {
  const segments: string[] = [];
  let cur: Node | undefined = node;
  while (cur) {
    if (cur.type === "property") {
      const key = cur.children?.[0]?.value;
      if (typeof key === "string") segments.unshift(key);
    }
    cur = cur.parent;
  }
  return segments;
}

type ModeVariant = {
  /** Resolver flat path, e.g. `"color.brand.accent@dark"`. */
  flatPath: string;
  /** AST path segments to the mode variant value node. */
  astSegments: (string | number)[];
};

// Detect when the cursor is inside a `$extensions.tic-tac-token.modes.*`
// block. Returns the mode-variant flat path (e.g.
// `color.brand.accent@dark`) and the AST segments to the mode block node.
function findModeVariant(
  ast: Node | undefined,
  offset: number,
): ModeVariant | undefined {
  if (!ast) return undefined;
  const deep = deepestNodeAt(ast, offset);
  const path = propertyPath(deep);
  // Pattern: …, <tokenName>, "$extensions", "tic-tac-token.modes", <modeName>
  const modesIdx = path.lastIndexOf("tic-tac-token.modes");
  if (modesIdx >= 2 && path[modesIdx - 1] === "$extensions") {
    const modeName = path[modesIdx + 1];
    if (modeName) {
      const tokenPath = path.slice(0, modesIdx - 1);
      return {
        flatPath: `${tokenPath.join(".")}@${modeName}`,
        astSegments: [...tokenPath, "$extensions", "tic-tac-token.modes", modeName],
      };
    }
  }
  return undefined;
}

export function hoverAt(
  result: AnalysisResult,
  position: Position,
  index?: WorkspaceIndex,
  uri?: string,
): Hover | undefined {
  const offset = positionToOffset(result.text, position);
  const enclosing = findEnclosingToken(result.ast, offset);
  if (!enclosing) return undefined;

  // Check if cursor is inside a mode variant block.
  const modeVariant = findModeVariant(result.ast, offset);

  // Resolver may have expanded `$extensions.tic-tac-token.modes` into
  // separate tokens. If the cursor is inside a mode variant block, use
  // the mode-variant path for lookup and pin the range to the block.
  const lookupPath = modeVariant?.flatPath ?? enclosing.path;
  const hoverNode = modeVariant?.astSegments
    ? findNodeAtLocation(result.ast!, modeVariant.astSegments)
    : undefined;

  // Build the literal token (pre-resolution) by flattening just the
  // node at this path from the original parsed value. We re-flatten the
  // whole document and pick the matching path — simpler than reaching
  // into the AST.
  const literalFlat = result.value !== undefined ? flattenTokens(result.value).tokens : [];
  let literal: FlatToken | undefined = literalFlat.find(
    (t) => t.path === lookupPath,
  );
  const resolved: FlatToken | undefined = result.resolved.byPath.get(
    lookupPath,
  );

  // Token-root `$ref` form: source has $ref but no $value, so
  // `flattenTokens` (which keys on $value) skipped it. Synthesize a
  // literal carrying the $ref pointer as the displayed value, with
  // $type taken from the resolved token. This keeps the hover popup
  // working over `{ $type, $ref }` tokens.
  if (!literal && resolved) {
    const raw = rawTokenAt(result.value, enclosing.path);
    if (raw && typeof raw.$ref === "string") {
      const inferredType =
        typeof raw.$type === "string" && isTokenType(raw.$type)
          ? raw.$type
          : resolved.$type;
      literal = {
        path: enclosing.path,
        $type: inferredType,
        typeInherited: typeof raw.$type !== "string" || !isTokenType(raw.$type),
        $value: raw.$ref,
        $description:
          typeof raw.$description === "string" ? raw.$description : undefined,
        $extensions:
          raw.$extensions && typeof raw.$extensions === "object"
            ? (raw.$extensions as Record<string, unknown>)
            : undefined,
        $deprecated:
          typeof raw.$deprecated === "boolean" ||
          typeof raw.$deprecated === "string"
            ? (raw.$deprecated as boolean | string)
            : undefined,
      };
    }
  }

  if (!literal) return undefined;

  // Cross-file resolution: if this token's value is an alias whose target
  // isn't in the current document but is defined elsewhere in the
  // workspace, resolve it from there and note the source file.
  let displayResolved = resolved;
  let resolvedFrom: string | undefined;
  let ambiguousIn: string[] | undefined;
  if (index && uri && typeof literal.$value === "string") {
    const targetPath = aliasTarget(literal.$value);
    const resolvedLocally =
      resolved !== undefined &&
      JSON.stringify(resolved.$value) !== JSON.stringify(literal.$value);
    if (targetPath && !resolvedLocally && !result.resolved.byPath.has(targetPath)) {
      const matches = index.lookup(targetPath, uri);
      if (matches.length > 0) {
        displayResolved = matches[0]!.token;
        resolvedFrom = basename(matches[0]!.uri);
        if (matches.length > 1) ambiguousIn = matches.map((m) => basename(m.uri));
      }
    }
  }

  const markdown = renderTokenHover(literal, displayResolved, {
    resolvedFrom,
    ambiguousIn,
  });
  return {
    contents: { kind: MarkupKind.Markdown, value: markdown },
    range: nodeRange(result.text, hoverNode ?? enclosing.node),
  };
}

// Last path segment of a URI, for a human-readable source label.
function basename(uri: string): string {
  const clean = uri.split(/[?#]/)[0] ?? uri;
  const parts = clean.split("/");
  return decodeURIComponent(parts[parts.length - 1] || clean);
}

