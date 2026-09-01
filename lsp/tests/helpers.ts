// Shared test helpers for driving the pure LSP handlers.

// Find the (line, character) of the first occurrence of `needle` in
// `text` — lets tests target positions without hardcoding offsets.
export function lineCharOf(
  text: string,
  needle: string,
): { line: number; character: number } {
  const idx = text.indexOf(needle);
  if (idx < 0) throw new Error(`needle not found: ${needle}`);
  const before = text.slice(0, idx);
  const line = (before.match(/\n/g) ?? []).length;
  const lastNewline = before.lastIndexOf("\n");
  const character = idx - (lastNewline + 1);
  return { line, character };
}
