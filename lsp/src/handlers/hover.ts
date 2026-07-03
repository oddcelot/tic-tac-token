import type { FlatToken } from "@oddsquad/tic-tac-token/resolver";
import { flattenTokens, isTokenType } from "@oddsquad/tic-tac-token/resolver";
import type { Node } from "jsonc-parser";
import { type Hover, MarkupKind, type Position } from "vscode-languageserver";
import type { AnalysisResult } from "../analyzer.ts";
import { renderTokenHover } from "../utils/hover-markdown.ts";
import { nodeRange } from "../utils/positions.ts";

// Convert (line, character) → byte offset for jsonc-parser's
// position-based APIs. Linear scan over the text; cheap for typical
// document sizes.
function positionToOffset(text: string, position: Position): number {
  let line = 0;
  let character = 0;
  for (let i = 0; i < text.length; i++) {
    if (line === position.line && character === position.character) return i;
    if (text.charCodeAt(i) === 0x0a /* \n */) {
      line++;
      character = 0;
    } else {
      character++;
    }
  }
  return text.length;
}

// Walk up the ancestor chain in the AST to find the nearest enclosing
// "token" node — an object that has a `$value` or `$ref` property.
// Returns the token node and its dot-path from the document root.
function findEnclosingToken(
  root: Node | undefined,
  offset: number,
): { node: Node; path: string } | undefined {
  if (!root) return undefined;

  function visit(node: Node, prefix: string[]): { node: Node; path: string } | undefined {
    if (offset < node.offset || offset > node.offset + node.length) return undefined;

    if (node.type === "object" && node.children) {
      const isToken = node.children.some(
        (pair) =>
          pair.children?.[0]?.value === "$value" ||
          pair.children?.[0]?.value === "$ref",
      );
      // Recurse into properties first to find the deepest match.
      for (const pair of node.children) {
        const key = pair.children?.[0]?.value;
        const child = pair.children?.[1];
        if (typeof key === "string" && !key.startsWith("$") && child) {
          const deeper = visit(child, [...prefix, key]);
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

export function hoverAt(
  result: AnalysisResult,
  position: Position,
): Hover | undefined {
  const offset = positionToOffset(result.text, position);
  const enclosing = findEnclosingToken(result.ast, offset);
  if (!enclosing) return undefined;

  // Build the literal token (pre-resolution) by flattening just the
  // node at this path from the original parsed value. We re-flatten the
  // whole document and pick the matching path — simpler than reaching
  // into the AST.
  const literalFlat = result.value !== undefined ? flattenTokens(result.value).tokens : [];
  let literal: FlatToken | undefined = literalFlat.find(
    (t) => t.path === enclosing.path,
  );
  const resolved: FlatToken | undefined = result.resolved.byPath.get(
    enclosing.path,
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

  const markdown = renderTokenHover(literal, resolved);
  return {
    contents: { kind: MarkupKind.Markdown, value: markdown },
    range: nodeRange(result.text, enclosing.node),
  };
}

