import type { FlatToken } from "@oddsquad/tic-tac-token/resolver";
import type { AnalysisResult } from "../analyzer.ts";

// A resolved token together with the document URI it came from. Used
// wherever the workspace-wide token set needs to be attributed back to
// its source file (cross-file alias resolution, "find references", ...).
export type IndexedToken = { uri: string; token: FlatToken };

// In-memory index of every analyzed token document in a workspace,
// keyed by document URI. Pure and synchronous — no filesystem access —
// so it can be driven directly by LSP `didOpen`/`didChange`/`didClose`
// events (whose text/analysis is already in hand) as well as by a
// filesystem scan (see host-node.ts) that feeds it files the editor
// hasn't opened yet.
//
// The per-path lookup table is rebuilt lazily: `upsert`/`remove` only
// flip a dirty flag, and the full rebuild happens on the next read. This
// keeps bulk workspace scans (many upserts in a row) cheap.
export class WorkspaceIndex {
  private analyses = new Map<string, AnalysisResult>();
  private byPath: Map<string, IndexedToken[]> | undefined;

  upsert(uri: string, analysis: AnalysisResult): void {
    this.analyses.set(uri, analysis);
    this.byPath = undefined;
  }

  remove(uri: string): void {
    if (this.analyses.delete(uri)) {
      this.byPath = undefined;
    }
  }

  has(uri: string): boolean {
    return this.analyses.has(uri);
  }

  /** The stored analysis for a document URI, if indexed. */
  analysisOf(uri: string): AnalysisResult | undefined {
    return this.analyses.get(uri);
  }

  /** Every indexed document and its analysis, for cross-file scans. */
  entries(): Array<{ uri: string; analysis: AnalysisResult }> {
    const out: Array<{ uri: string; analysis: AnalysisResult }> = [];
    for (const [uri, analysis] of this.analyses) out.push({ uri, analysis });
    return out;
  }

  /** All resolved tokens across all indexed files. */
  allTokens(): IndexedToken[] {
    const result: IndexedToken[] = [];
    for (const bucket of this.ensureIndex().values()) {
      result.push(...bucket);
    }
    return result;
  }

  /** Tokens matching a flat dot-path, excluding excludeUri. Sorted by uri (deterministic). */
  lookup(path: string, excludeUri?: string): IndexedToken[] {
    const bucket = this.ensureIndex().get(path) ?? [];
    return excludeUri ? bucket.filter((entry) => entry.uri !== excludeUri) : bucket;
  }

  private ensureIndex(): Map<string, IndexedToken[]> {
    if (!this.byPath) {
      this.byPath = this.buildIndex();
    }
    return this.byPath;
  }

  private buildIndex(): Map<string, IndexedToken[]> {
    const byPath = new Map<string, IndexedToken[]>();
    for (const [uri, analysis] of this.analyses) {
      const tokens = analysis.resolved?.tokens;
      if (!tokens) continue;
      for (const token of tokens) {
        const entry: IndexedToken = { uri, token };
        const bucket = byPath.get(token.path);
        if (bucket) bucket.push(entry);
        else byPath.set(token.path, [entry]);
      }
    }
    for (const bucket of byPath.values()) {
      bucket.sort((a, b) => (a.uri < b.uri ? -1 : a.uri > b.uri ? 1 : 0));
    }
    return byPath;
  }
}
