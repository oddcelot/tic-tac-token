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

export function offsetToPosition(text: string, offset: number): Position {
  const table = lineTable(text);
  let lo = 0;
  let hi = table.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (table[mid]! <= offset) lo = mid;
    else hi = mid - 1;
  }
  return { line: lo, character: offset - table[lo]! };
}

export function nodeRange(text: string, node: Node): Range {
  return {
    start: offsetToPosition(text, node.offset),
    end: offsetToPosition(text, node.offset + node.length),
  };
}
