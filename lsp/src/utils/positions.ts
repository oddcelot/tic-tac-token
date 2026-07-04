import type { Node } from "jsonc-parser";
import type { Position, Range } from "vscode-languageserver";

// Build a line-offset table over the document text: offsets[i] is the
// character offset of line i's first character.
function lineTable(text: string): number[] {
  const offsets: number[] = [0];
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 0x0a /* \n */) offsets.push(i + 1);
  }
  return offsets;
}

function lookupPosition(table: number[], offset: number): Position {
  let lo = 0;
  let hi = table.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (table[mid]! <= offset) lo = mid;
    else hi = mid - 1;
  }
  return { line: lo, character: offset - table[lo]! };
}

export function offsetToPosition(text: string, offset: number): Position {
  return lookupPosition(lineTable(text), offset);
}

// Converter that reuses one line table across many lookups. Use this
// when emitting many ranges per document (semantic tokens, document
// colors) — `offsetToPosition` rebuilds the table on every call.
export function makeOffsetToPosition(text: string): (offset: number) => Position {
  const table = lineTable(text);
  return (offset) => lookupPosition(table, offset);
}

// Convert (line, character) → byte offset for jsonc-parser's
// position-based APIs. Linear scan over the text; cheap for typical
// document sizes.
export function positionToOffset(text: string, position: Position): number {
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

export function nodeRange(text: string, node: Node): Range {
  return {
    start: offsetToPosition(text, node.offset),
    end: offsetToPosition(text, node.offset + node.length),
  };
}
