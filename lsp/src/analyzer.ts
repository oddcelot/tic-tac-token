import { TokensFile } from "dtcg-tokens";
import { resolveTokens, type ResolvedTokens } from "dtcg-tokens/resolver";
import { parseTree, type Node, type ParseError } from "jsonc-parser";

export type AnalysisResult = {
  text: string;
  /** jsonc-parser AST root; undefined when the doc is empty/unparseable. */
  ast: Node | undefined;
  /** Syntactic errors from jsonc-parser. */
  syntaxErrors: ParseError[];
  /** Parsed plain JS value (may be undefined on total parse failure). */
  value: unknown;
  /** arktype Standard-Schema issues against TokensFile. */
  validationIssues: ReadonlyArray<{
    readonly message: string;
    readonly path?: ReadonlyArray<PropertyKey | { key: PropertyKey }>;
  }>;
  /** Resolved tokens + reference graph + resolver errors. */
  resolved: ResolvedTokens;
};

// One-shot analysis. The LSP layer is responsible for debouncing per
// document; the analyzer itself is pure-functional so unit tests can
// drive it without spinning up an LSP.
export async function analyze(text: string): Promise<AnalysisResult> {
  const syntaxErrors: ParseError[] = [];
  const ast = parseTree(text, syntaxErrors, {
    allowTrailingComma: false,
    disallowComments: true,
  });

  let value: unknown;
  try {
    value = text.trim().length > 0 ? JSON.parse(text) : undefined;
  } catch {
    value = undefined;
  }

  let validationIssues: AnalysisResult["validationIssues"] = [];
  if (value !== undefined) {
    const result = await TokensFile["~standard"].validate(value);
    if (result.issues) validationIssues = result.issues;
  }

  const resolved: ResolvedTokens =
    value !== undefined && typeof value === "object" && value !== null
      ? resolveTokens(value)
      : { tokens: [], byPath: new Map(), errors: [], references: new Map() };

  return { text, ast, syntaxErrors, value, validationIssues, resolved };
}
