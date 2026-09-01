// Node filesystem implementation of WorkspaceHost. This module touches
// `node:fs`/`node:url` and must never be imported from browser-targeted
// code paths (server-browser.ts, workspace/index.ts, etc.) — only
// server.ts (the Node stdio entry point) may import it.
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { ScanOptions, WorkspaceFile, WorkspaceHost } from "./host.ts";

const TOKEN_FILE_RE = /\.tokens(\.json)?$/;

export function createNodeWorkspaceHost(): WorkspaceHost {
  return {
    async scan(rootUris, options) {
      const files: WorkspaceFile[] = [];
      for (const rootUri of rootUris) {
        if (files.length >= options.maxFiles) break;
        const rootPath = toFsPath(rootUri);
        if (rootPath === undefined) continue;
        await walk(rootPath, options, files);
      }
      return files;
    },

    async read(uri) {
      const path = toFsPath(uri);
      if (path === undefined) return undefined;
      try {
        return await readFile(path, "utf8");
      } catch {
        return undefined;
      }
    },
  };
}

// Non-file:// URIs (and malformed URIs) are skipped rather than thrown —
// a workspace root or a lookup URI from an editor can legitimately be a
// scheme this host doesn't understand.
function toFsPath(uri: string): string | undefined {
  try {
    const url = new URL(uri);
    if (url.protocol !== "file:") return undefined;
    return fileURLToPath(url);
  } catch {
    return undefined;
  }
}

async function walk(dir: string, options: ScanOptions, files: WorkspaceFile[]): Promise<void> {
  if (files.length >= options.maxFiles) return;

  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    // Unreadable directory (permissions, race with deletion, ...) — skip
    // it without aborting the rest of the walk.
    return;
  }

  for (const entry of entries) {
    if (files.length >= options.maxFiles) return;

    // Symlinks are skipped outright: for directories this avoids walk
    // cycles, and treating symlinked files the same keeps the rule
    // simple and predictable.
    if (entry.isSymbolicLink()) continue;

    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (options.excludeDirs.includes(entry.name)) continue;
      try {
        await walk(fullPath, options, files);
      } catch {
        continue;
      }
      continue;
    }

    if (!entry.isFile() || !TOKEN_FILE_RE.test(entry.name)) continue;

    try {
      const stats = await stat(fullPath);
      if (stats.size > options.maxFileBytes) continue;
      const text = await readFile(fullPath, "utf8");
      files.push({ uri: pathToFileURL(fullPath).toString(), text });
    } catch {
      continue;
    }
  }
}
