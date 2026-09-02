// Reading a resolver document and its `$ref` targets off disk.
//
// `resolveResolverDocument` deliberately does no I/O: it takes externals
// pre-parsed, which keeps resolution synchronous and keeps the core package
// usable in a browser. Something still has to read the files, though, and
// every consumer that does — a CLI, a Vite plugin, the Storybook preset —
// would otherwise reimplement the same `$ref` walk.
//
// This is the one entry point in the package that touches `node:fs`. It lives
// behind the `./node` subpath so `.`, `./resolver`, `./resolver-module` and
// `./css` stay platform-free.
import { readFile, readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";

export type LoaderDiagnostic = {
  /** The document the problem was found in, as a path or URI. */
  at: string;
  message: string;
  /** The `$ref` that could not be honoured, when the problem was a reference. */
  target?: string;
};

export type LoadedResolverDocument = {
  /** Absolute path the entry document was read from. */
  path: string;
  /** The parsed entry document, or `undefined` when it could not be read. */
  document: unknown;
  /**
   * Every referenced document, keyed by the exact pre-`#` URI string as
   * written in the `$ref` — which is what `ResolveResolverOptions` expects.
   */
  externalDocuments: Record<string, unknown>;
  errors: LoaderDiagnostic[];
};

/** The pre-`#` portion of a pointer — the document it refers to. */
function refUri(pointer: string): string {
  const hash = pointer.indexOf("#");
  return hash === -1 ? pointer : pointer.slice(0, hash);
}

/** Collect every `{ $ref: string }` URI in a parsed document, in encounter order. */
function collectRefUris(node: unknown, out: Set<string>): void {
  if (Array.isArray(node)) {
    for (const item of node) collectRefUris(item, out);
    return;
  }
  if (!node || typeof node !== "object") return;
  const rec = node as Record<string, unknown>;
  if (typeof rec.$ref === "string") {
    const uri = refUri(rec.$ref);
    // An empty URI is a same-document pointer; nothing to load.
    if (uri !== "") out.add(uri);
  }
  for (const value of Object.values(rec)) collectRefUris(value, out);
}

const REMOTE = /^[a-z][a-z0-9+.-]*:\/\//i;

type LoadOutcome =
  | { ok: true; value: unknown }
  | { ok: false; message: string };

function parseJson(text: string, at: string): LoadOutcome {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (error) {
    return {
      ok: false,
      message: `${at} is not valid JSON: ${(error as Error).message}`,
    };
  }
}

/**
 * Shared walk over the reference graph. `read` returns the file's text, or an
 * error message; everything else — queueing, keying, diagnostics — is the same
 * for the sync and async entry points.
 */
function walk(
  entry: string,
  read: (path: string) => LoadOutcome,
): LoadedResolverDocument {
  const path = isAbsolute(entry) ? entry : resolve(entry);
  const baseDir = dirname(path);
  const errors: LoaderDiagnostic[] = [];
  const externalDocuments: Record<string, unknown> = {};

  const entryText = read(path);
  if (!entryText.ok) {
    errors.push({ at: path, message: entryText.message });
    return { path, document: undefined, externalDocuments, errors };
  }
  const parsed = parseJson(entryText.value as string, path);
  if (!parsed.ok) {
    errors.push({ at: path, message: parsed.message });
    return { path, document: undefined, externalDocuments, errors };
  }
  const document = parsed.value;

  // Breadth-first over the reference graph. `from` is only used for
  // diagnostics — every URI resolves against the entry's directory, see below.
  const queue: { uri: string; from: string }[] = [];
  const seenUris = new Set<string>();

  const enqueueFrom = (node: unknown, from: string): void => {
    const uris = new Set<string>();
    collectRefUris(node, uris);
    for (const uri of uris) {
      if (seenUris.has(uri)) continue;
      seenUris.add(uri);
      queue.push({ uri, from });
    }
  };

  enqueueFrom(document, path);

  while (queue.length > 0) {
    const { uri, from } = queue.shift()!;

    if (REMOTE.test(uri)) {
      errors.push({
        at: from,
        target: uri,
        message: `Remote references are not fetched; supply "${uri}" through options.externalDocuments if you need it.`,
      });
      continue;
    }

    // Every URI resolves against the ENTRY document's directory, not the
    // directory of the document that wrote the reference.
    //
    // `externalDocuments` is keyed by the raw URI string, so two documents in
    // different directories that both write `{"$ref": "./colors.json"}` would
    // otherwise collide on one key with two different meanings. Resolving
    // everything from a single base keeps the key unambiguous; the cost is
    // that a nested relative reference means something different here than it
    // would to a JSON Schema resolver, which is why it is diagnosed below.
    const filePath = resolve(baseDir, uri);
    const text = read(filePath);
    if (!text.ok) {
      errors.push({ at: from, target: uri, message: text.message });
      continue;
    }
    const doc = parseJson(text.value as string, filePath);
    if (!doc.ok) {
      errors.push({ at: from, target: uri, message: doc.message });
      continue;
    }

    externalDocuments[uri] = doc.value;

    const nested = new Set<string>();
    collectRefUris(doc.value, nested);
    for (const child of nested) {
      if (!REMOTE.test(child) && !isAbsolute(child)) {
        errors.push({
          at: uri,
          target: child,
          message: `"${uri}" contains the relative reference "${child}", which is resolved against the entry document's directory rather than "${uri}"'s. Write it relative to "${path}" or the reference will not point where it reads as pointing.`,
        });
      }
    }
    enqueueFrom(doc.value, uri);
  }

  return { path, document, externalDocuments, errors };
}

function readSync(path: string): LoadOutcome {
  try {
    return { ok: true, value: readFileSync(path, "utf8") };
  } catch (error) {
    return { ok: false, message: `Could not read ${path}: ${(error as Error).message}` };
  }
}

/**
 * Read a resolver document and every document it references, producing the
 * `{ document, externalDocuments }` pair `resolveResolverDocument` and
 * `resolverDocumentToCssTheme` expect.
 *
 * Never throws: a missing or malformed file becomes a diagnostic, and whatever
 * did load is still returned.
 */
export function loadResolverDocumentSync(entry: string): LoadedResolverDocument {
  return walk(entry, readSync);
}

/** Asynchronous {@link loadResolverDocumentSync}. */
export async function loadResolverDocument(entry: string): Promise<LoadedResolverDocument> {
  const cache = new Map<string, LoadOutcome>();
  const paths = new Set<string>();

  // Two passes: discover the file set with the sync-shaped walk against a
  // recording reader, then read them all concurrently and replay. Keeps one
  // implementation of the graph walk rather than two that can drift.
  const record = (path: string): LoadOutcome => {
    paths.add(path);
    const hit = cache.get(path);
    return hit ?? { ok: false, message: "" };
  };

  let previous = -1;
  // Each pass discovers the next layer of references; it terminates because
  // `paths` only grows and the reference graph is finite.
  while (paths.size !== previous) {
    previous = paths.size;
    walk(entry, record);
    await Promise.all(
      [...paths]
        .filter((p) => !cache.has(p))
        .map(async (p) => {
          try {
            cache.set(p, {
              ok: true,
              value: await new Promise<string>((res, rej) =>
                readFile(p, "utf8", (err, data) => (err ? rej(err) : res(data))),
              ),
            });
          } catch (error) {
            cache.set(p, {
              ok: false,
              message: `Could not read ${p}: ${(error as Error).message}`,
            });
          }
        }),
    );
  }

  return walk(entry, (path) => cache.get(path) ?? readSync(path));
}
