// Platform-neutral contract for discovering and reading design-token
// files in a workspace. Implementations live per-runtime: a Node
// filesystem walker (host-node.ts, server.ts-only), and — in the
// future — a browser host backed by whatever the host editor exposes
// (e.g. an in-memory VFS or a workspace/fs bridge over LSP).
export type WorkspaceFile = { uri: string; text: string };

export type ScanOptions = {
  excludeDirs: string[];
  maxFiles: number;
  maxFileBytes: number;
};

export type WorkspaceHost = {
  scan(rootUris: string[], options: ScanOptions): Promise<WorkspaceFile[]>;
  read(uri: string): Promise<string | undefined>;
};

export const DEFAULT_SCAN_OPTIONS: ScanOptions = {
  excludeDirs: ["node_modules", ".git", "dist", "build", "out"],
  maxFiles: 500,
  maxFileBytes: 1024 * 1024,
};
