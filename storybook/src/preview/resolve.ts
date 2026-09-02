// Resolving the token set for the story currently being rendered.
//
// Resolution happens in the browser, on every globals change. That is cheap —
// `resolveResolverDocument` is synchronous and does no I/O — and arktype is
// already in the preview bundle because `resolveTokens` pulls in all 13 value
// schemas. In exchange, editing a token JSON invalidates the consumer's
// `preview.ts` module graph and the stories re-resolve with no build wiring.
//
// Results are memoised per (document identity, inputs), so a re-render with
// unchanged globals costs a map lookup.
import { resolveResolverDocument } from "@oddsquad/tic-tac-token/resolver-module";
import type {
  ResolverInputs,
  ResolverModuleError,
} from "@oddsquad/tic-tac-token/resolver-module";
import type { FlatToken, ResolverError } from "@oddsquad/tic-tac-token/resolver";
import { tokensToCssVars } from "@oddsquad/tic-tac-token/css";
import { inputsFromGlobals } from "./resolverConfig.ts";
import { parseTokens, tokenSourceFromParameters } from "./tokens.ts";
import type { TokenRenderContext } from "./tokens.ts";

export type TokenResolution = {
  /** Resolved tokens for the active combination. Mode variants are excluded. */
  tokens: FlatToken[];
  byPath: Map<string, FlatToken>;
  /** The resolver inputs this resolution was produced with. */
  inputs: ResolverInputs;
  /** Custom-property declarations for this combination. No selector. */
  css: string;
  documentErrors: ResolverModuleError[];
  tokenErrors: ResolverError[];
};

const EMPTY: TokenResolution = {
  tokens: [],
  byPath: new Map(),
  inputs: {},
  css: "",
  documentErrors: [],
  tokenErrors: [],
};

// Keyed on the resolver document's object identity, so an HMR-replaced module
// yields a new object and therefore a fresh cache for free.
const cache = new WeakMap<object, Map<string, TokenResolution>>();
const warnedAboutModes = new WeakSet<object>();

function cacheKey(inputs: ResolverInputs): string {
  return JSON.stringify(Object.entries(inputs).sort(([a], [b]) => a.localeCompare(b)));
}

function warnOnceAboutModes(document: object, count: number): void {
  if (warnedAboutModes.has(document)) return;
  warnedAboutModes.add(document);
  console.warn(
    `[tic-tac-token] Ignored ${count} token(s) using the legacy ` +
      `$extensions["tic-tac-token.modes"] extension. A resolver document ` +
      `already expresses this as a modifier — declare a colorScheme modifier ` +
      `with light/dark contexts instead, and the mode variants can be deleted.`,
  );
}

/**
 * Resolve the token set for a story's current parameters and globals.
 *
 * Accepts every supported parameter shape and always returns the same type, so
 * nothing downstream has to branch on how the tokens were supplied.
 */
export function resolveForContext(context: TokenRenderContext): TokenResolution {
  const source = tokenSourceFromParameters(context);
  if (!source) return EMPTY;

  if (source.kind === "document") {
    // Legacy path: a whole raw document, with light/dark selected by filtering
    // `tic-tac-token.modes` variants.
    const scheme = context?.globals?.["colorScheme"];
    const mode = scheme === "dark" ? "dark" : "light";
    const tokens = parseTokens(source.raw, mode);
    return {
      tokens,
      byPath: new Map(tokens.map((t) => [t.path, t])),
      inputs: {},
      css: tokensToCssVars(tokens).css,
      documentErrors: [],
      tokenErrors: [],
    };
  }

  const document = source.document;
  if (!document || typeof document !== "object") return EMPTY;

  const inputs = inputsFromGlobals(document, context?.globals);
  const key = cacheKey(inputs);

  let perDocument = cache.get(document as object);
  if (!perDocument) {
    perDocument = new Map();
    cache.set(document as object, perDocument);
  }
  const hit = perDocument.get(key);
  if (hit) return hit;

  const result = resolveResolverDocument(document, inputs, {
    externalDocuments: source.externalDocuments,
  });

  // Mode variants share a custom property with their own base, so leaving them
  // in would let a `@dark` value clobber the resolved role in a light context.
  // The Resolver Module supersedes them; warn once so the document gets fixed.
  const all = result.tokens.tokens;
  const tokens = all.filter((t) => t.mode === undefined);
  if (tokens.length !== all.length) {
    warnOnceAboutModes(document as object, all.length - tokens.length);
  }

  const resolution: TokenResolution = {
    tokens,
    byPath: new Map(tokens.map((t) => [t.path, t])),
    inputs,
    css: tokensToCssVars(tokens).css,
    documentErrors: result.documentErrors,
    tokenErrors: result.tokenErrors,
  };

  perDocument.set(key, resolution);
  return resolution;
}
