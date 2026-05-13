import { printParseErrorCode } from "jsonc-parser";
import {
  type Diagnostic,
  DiagnosticSeverity,
} from "vscode-languageserver";
import type { AnalysisResult } from "../analyzer.ts";
import { nodeAtPath, nodeForTokenPath, normalizeIssuePath } from "../utils/json-path.ts";
import { nodeRange, offsetToPosition } from "../utils/positions.ts";

const SOURCE = "dtcg-tokens";

function fallbackRange(text: string): { start: { line: number; character: number }; end: { line: number; character: number } } {
  return {
    start: offsetToPosition(text, 0),
    end: offsetToPosition(text, Math.min(text.length, 1)),
  };
}

export function diagnosticsFromAnalysis(result: AnalysisResult): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  // 1. Syntax errors from jsonc-parser
  for (const err of result.syntaxErrors) {
    diagnostics.push({
      severity: DiagnosticSeverity.Error,
      range: {
        start: offsetToPosition(result.text, err.offset),
        end: offsetToPosition(result.text, err.offset + err.length),
      },
      source: SOURCE,
      message: `JSON syntax: ${printParseErrorCode(err.error)}`,
    });
  }

  // 2. arktype validation issues
  for (const issue of result.validationIssues) {
    const path = normalizeIssuePath(issue.path);
    const node = nodeAtPath(result.ast, path);
    const range = node ? nodeRange(result.text, node) : fallbackRange(result.text);
    diagnostics.push({
      severity: DiagnosticSeverity.Error,
      range,
      source: SOURCE,
      message: issue.message,
    });
  }

  // 3. Resolver errors (broken aliases/refs, cycles, type-mismatch, $extends)
  for (const err of result.resolved.errors) {
    // err.at is either a dot-path or the sentinel "(root)"
    const tokenPath = err.at === "(root)" ? "" : err.at;
    const node = tokenPath ? nodeForTokenPath(result.ast, tokenPath) : result.ast;
    const range = node ? nodeRange(result.text, node) : fallbackRange(result.text);
    diagnostics.push({
      severity: severityFor(err.kind),
      range,
      source: SOURCE,
      message: err.message,
      code: err.kind,
    });
  }

  return diagnostics;
}

function severityFor(kind: string): DiagnosticSeverity {
  switch (kind) {
    case "broken-ref":
    case "broken-alias":
    case "broken-extends":
    case "ref-cycle":
    case "alias-cycle":
    case "extends-cycle":
      return DiagnosticSeverity.Error;
    case "type-mismatch":
      return DiagnosticSeverity.Warning;
    default:
      return DiagnosticSeverity.Information;
  }
}
