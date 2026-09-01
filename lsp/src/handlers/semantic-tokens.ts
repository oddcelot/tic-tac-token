import { aliasTarget } from "@oddsquad/tic-tac-token/resolver";
import type { Node } from "jsonc-parser";
import { SemanticTokensBuilder } from "vscode-languageserver";
import type { SemanticTokens } from "vscode-languageserver";
import type { AnalysisResult } from "../analyzer.ts";
import { makeOffsetToPosition } from "../utils/positions.ts";

// Mirrors flatten.ts's MODES_KEY — the `$extensions` sub-key under which
// mode variants live: `<token>.$extensions."tic-tac-token.modes".<mode>`.
const MODES_KEY = "tic-tac-token.modes";

export const semanticTokensLegend = {
  tokenTypes: ["namespace", "property", "variable", "enumMember"],
  tokenModifiers: ["declaration", "deprecated", "reference", "unresolved"],
};

const TYPE = {
  namespace: semanticTokensLegend.tokenTypes.indexOf("namespace"),
  property: semanticTokensLegend.tokenTypes.indexOf("property"),
  variable: semanticTokensLegend.tokenTypes.indexOf("variable"),
  enumMember: semanticTokensLegend.tokenTypes.indexOf("enumMember"),
};

const MOD = {
  declaration: 1 << semanticTokensLegend.tokenModifiers.indexOf("declaration"),
  deprecated: 1 << semanticTokensLegend.tokenModifiers.indexOf("deprecated"),
  reference: 1 << semanticTokensLegend.tokenModifiers.indexOf("reference"),
  unresolved: 1 << semanticTokensLegend.tokenModifiers.indexOf("unresolved"),
};

// A "token" object is one with a `$value` or `$ref` property (same test
// as hover.ts's `findEnclosingToken`).
function isTokenObject(node: Node): boolean {
  return !!node.children?.some(
    (pair) => pair.children?.[0]?.value === "$value" || pair.children?.[0]?.value === "$ref",
  );
}

/**
 * resolvesInWorkspace: optional cross-file fallback — returns true when a
 * dot-path that misses the local document resolves elsewhere in the
 * workspace. Wired to the workspace index by the caller.
 */
export function semanticTokensFull(
  result: AnalysisResult,
  resolvesInWorkspace?: (path: string) => boolean,
): SemanticTokens {
  const builder = new SemanticTokensBuilder();
  const toPosition = makeOffsetToPosition(result.text);

  // Keys are always JSON strings — trim the surrounding quotes.
  function pushKey(keyNode: Node, typeIdx: number, modBits: number) {
    const pos = toPosition(keyNode.offset + 1);
    builder.push(pos.line, pos.character, keyNode.length - 2, typeIdx, modBits);
  }

  // Value strings keep their quotes (whole node range).
  function pushValueString(valueNode: Node, typeIdx: number, modBits: number) {
    const pos = toPosition(valueNode.offset);
    builder.push(pos.line, pos.character, valueNode.length, typeIdx, modBits);
  }

  function emitAliasIfPresent(stringNode: Node) {
    if (typeof stringNode.value !== "string") return;
    const target = aliasTarget(stringNode.value);
    if (!target) return;
    let modBits = MOD.reference;
    const existsLocally = result.resolved.byPath.has(target);
    if (!existsLocally && !resolvesInWorkspace?.(target)) {
      modBits |= MOD.unresolved;
    }
    pushValueString(stringNode, TYPE.variable, modBits);
  }

  // Pure alias-string search — used for `$value` contents and mode-block
  // values, where nested object keys (composite-type sub-fields like
  // `colorSpace`/`components`) are NOT part of the token/group tree and
  // must not be classified as namespace/property. Only alias strings
  // found anywhere inside are surfaced (rule 3 applies "anywhere").
  function scanForAliases(node: Node | undefined) {
    if (!node) return;
    if (node.type === "string") {
      emitAliasIfPresent(node);
      return;
    }
    if (node.children) {
      for (const child of node.children) scanForAliases(child);
    }
  }

  // Walk the token-tree structure: an object whose properties are either
  // `$`-prefixed metadata or plain group/token keys. `inModesBlock` is
  // true when `node` is the `$extensions."tic-tac-token.modes"` object
  // itself, whose immediate children are mode names, not path segments.
  function walkObject(node: Node, path: string[], inModesBlock: boolean) {
    if (!node.children) return;
    for (const pair of node.children) {
      const keyNode = pair.children?.[0];
      const valueNode = pair.children?.[1];
      if (!keyNode || typeof keyNode.value !== "string" || !valueNode) continue;
      const key = keyNode.value;

      if (inModesBlock) {
        // Mode content sits at `<token>@<mode>` in the flat resolved
        // tree, not as a further path segment here — only the key
        // itself is classified; its value is scanned for aliases.
        pushKey(keyNode, TYPE.enumMember, MOD.declaration);
        scanForAliases(valueNode);
        continue;
      }

      if (key === "$value") {
        scanForAliases(valueNode);
        continue;
      }

      if (key === "$ref") {
        if (valueNode.type === "string" && typeof valueNode.value === "string") {
          const target = valueNode.value;
          let modBits = MOD.reference;
          const broken = result.resolved.errors.some(
            (e) => e.kind === "broken-ref" && e.target === target,
          );
          if (broken && !resolvesInWorkspace?.(target)) {
            modBits |= MOD.unresolved;
          }
          pushValueString(valueNode, TYPE.variable, modBits);
        }
        continue;
      }

      if (key === "$type") {
        if (valueNode.type === "string") {
          pushValueString(valueNode, TYPE.enumMember, 0);
        }
        continue;
      }

      if (key === "$extensions") {
        if (valueNode.type === "object" && valueNode.children) {
          for (const extPair of valueNode.children) {
            const extKey = extPair.children?.[0];
            const extValue = extPair.children?.[1];
            if (!extKey || !extValue) continue;
            if (extKey.value === MODES_KEY && extValue.type === "object") {
              walkObject(extValue, path, true);
            } else {
              scanForAliases(extValue);
            }
          }
        }
        continue;
      }

      if (key.startsWith("$")) {
        // $description, $deprecated, and other metadata: nothing to emit.
        continue;
      }

      // Plain (non-`$`) key: either a group or a token.
      if (valueNode.type === "object") {
        const nextPath = [...path, key];
        if (isTokenObject(valueNode)) {
          const flatPath = nextPath.join(".");
          let modBits = MOD.declaration;
          if (result.resolved.byPath.get(flatPath)?.$deprecated) {
            modBits |= MOD.deprecated;
          }
          pushKey(keyNode, TYPE.property, modBits);
          walkObject(valueNode, nextPath, false);
        } else {
          pushKey(keyNode, TYPE.namespace, 0);
          walkObject(valueNode, nextPath, false);
        }
      }
    }
  }

  if (result.ast?.type === "object") {
    walkObject(result.ast, [], false);
  }

  return builder.build();
}
