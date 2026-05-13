import type { FlatToken } from "./types.ts";

// Clamp `gradient.position` values to [0, 1] per DTCG 2025.10 §6.5.
// Validation accepts any number; the resolver pass is where clamping
// happens. Aliases targeting `number` tokens have already been
// dereferenced by the alias pass; we only need to handle inline numbers
// at this point.
//
// Returns a new token list; original values are not mutated.
export function clampGradients(tokens: FlatToken[]): FlatToken[] {
  return tokens.map((token) => {
    if (token.$type !== "gradient") return token;
    if (!Array.isArray(token.$value)) return token;
    const stops = token.$value.map((stop) => {
      if (!stop || typeof stop !== "object" || Array.isArray(stop)) return stop;
      const rec = stop as Record<string, unknown>;
      if (typeof rec.position !== "number") return stop;
      const clamped = Math.max(0, Math.min(1, rec.position));
      if (clamped === rec.position) return stop;
      return { ...rec, position: clamped };
    });
    return { ...token, $value: stops };
  });
}
