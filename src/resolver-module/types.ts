import type { ResolvedTokens } from "../resolver/types.ts";

// Diagnostics for the resolver *document* — deliberately a separate union
// from src/resolver/types.ts's ResolverError, which describes failures in a
// tokens document. The two are different failure domains, and merging them
// would force every existing consumer's exhaustive switch to grow branches
// it can never see.
export type ResolverModuleErrorKind =
  /** Document rejected by the ResolverDocument schema. */
  | "invalid-document"
  /** Malformed, dangling, or out-of-bounds `$ref` pointer. */
  | "invalid-pointer"
  /** Reference objects forming a cycle. */
  | "ref-cycle"
  /** A set or modifier referencing a modifier (only resolutionOrder may). */
  | "invalid-reference-target"
  /** Two resolutionOrder entries contributing the same name. */
  | "duplicate-name"
  /** Inline resolutionOrder entry missing `name` and/or `type`. */
  | "missing-name-or-type"
  /** Modifier with an empty `contexts` map (§4.1.5.1, MUST). */
  | "modifier-no-contexts"
  /** Modifier with exactly one context (§4.1.5.1, SHOULD). */
  | "modifier-single-context"
  /** Modifier `default` naming a context that doesn't exist. */
  | "invalid-default"
  /** Input key matching no modifier. */
  | "unknown-input-key"
  /** Non-string input, or a string naming no context of that modifier. */
  | "invalid-input-value"
  /** Modifier without a `default` and without a supplied input. */
  | "missing-required-input";

export type ResolverModuleError = {
  kind: ResolverModuleErrorKind;
  /** Document location, e.g. `resolutionOrder[1]` or `modifiers.theme`. */
  at: string;
  message: string;
  /** For reference errors: the pointer the reference targeted. */
  target?: string;
};

export type ResolverInputs = Record<string, string>;

export type ResolveResolverOptions = {
  /**
   * Pre-parsed documents for external `$ref`s, keyed by the pre-`#` portion
   * of the pointer (e.g. `"tokens/base.json"`). Same-document refs need no
   * entry. Kept as a map rather than a loader callback so resolution stays
   * synchronous, like every other entry point in this package.
   */
  externalDocuments?: Record<string, unknown>;
};

export type ResolvedResolverDocument = {
  /** Output of the format-module pipeline over the merged tree. */
  tokens: ResolvedTokens;
  /** The merged token tree, before alias resolution. Useful for debugging. */
  mergedTree: Record<string, unknown>;
  /** Diagnostics about the resolver document itself. */
  documentErrors: ResolverModuleError[];
  /** Diagnostics from resolving the merged tokens document. */
  tokenErrors: ResolvedTokens["errors"];
};
