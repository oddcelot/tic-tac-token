import { deepMergeGroup } from "../resolver/extends.ts";
import { resolveTokens } from "../resolver/index.ts";
import { jsonPointerGet } from "../resolver/json-pointer.ts";
import { buildResolutionOrder } from "./order.ts";
import type { OrderEntry, ResolutionOrder } from "./order.ts";
import type {
  ResolvedResolverDocument,
  ResolveResolverOptions,
  ResolverInputs,
  ResolverModuleError,
} from "./types.ts";

export { ResolverDocument, SetDef, ModifierDef } from "./schema.ts";
export { buildResolutionOrder, resolverModifiers } from "./order.ts";
export type {
  OrderEntry,
  ResolutionOrder,
  ResolverModifierInfo,
} from "./order.ts";
export type {
  ResolverModuleError,
  ResolverModuleErrorKind,
  ResolverInputs,
  ResolveResolverOptions,
  ResolvedResolverDocument,
} from "./types.ts";

type Rec = Record<string, unknown>;

// Sources are independent documents, so a `$extends` inside one is content
// to preserve, not an inheritance link to consume.
const MERGE_OPTIONS = { keepExtends: true } as const;

function isPlainObject(value: unknown): value is Rec {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/**
 * Resolve a DTCG 2025.10 Resolver Module document into a tokens document.
 *
 * Follows resolver §6: validate inputs, walk `resolutionOrder` merging sets
 * and the selected modifier contexts into a single tokens structure, then —
 * and only then — resolve aliases by handing the merged tree to the format
 * module's `resolveTokens`.
 *
 * Errors are collected rather than thrown: `documentErrors` describes the
 * resolver document, `tokenErrors` the tokens it produced.
 */
export function resolveResolverDocument(
  document: unknown,
  inputs: ResolverInputs = {},
  options: ResolveResolverOptions = {},
): ResolvedResolverDocument {
  return resolveFromOrder(buildResolutionOrder(document), inputs, options);
}

/**
 * Resolve against an already-validated resolution order.
 *
 * Exported for callers that resolve the same document at many input
 * combinations — the ordering pass is input-independent, so hoisting it out of
 * the loop avoids re-running arktype once per permutation.
 */
export function resolveFromOrder(
  order: ResolutionOrder,
  inputs: ResolverInputs = {},
  options: ResolveResolverOptions = {},
): ResolvedResolverDocument {
  // A fresh array per call: the merge phase appends per-input diagnostics
  // (`missing-required-input`, `invalid-input-value`), and a shared order is
  // reused across permutations, so pushing onto `order.errors` would leak one
  // combination's errors into the next.
  const documentErrors: ResolverModuleError[] = [...order.errors];
  const external = options.externalDocuments ?? {};
  const doc = order.doc;

  if (!doc) return emptyResult(documentErrors);

  const namedModifiers = isPlainObject(doc.modifiers) ? doc.modifiers : {};
  const entries = order.entries;

  // ── Input validation (§6.1). Skipped entirely when no modifiers exist.
  const modifiersByLowerName = new Map<string, OrderEntry>();
  for (const entry of entries) {
    if (entry.kind === "modifier") {
      modifiersByLowerName.set(entry.name.toLowerCase(), entry);
    }
  }

  const inputByLowerName = new Map<string, unknown>();
  if (modifiersByLowerName.size > 0 || Object.keys(namedModifiers).length > 0) {
    for (const [key, value] of Object.entries(inputs)) {
      const lower = key.toLowerCase();
      inputByLowerName.set(lower, value);
      const modifier = modifiersByLowerName.get(lower);
      if (!modifier) {
        documentErrors.push({
          kind: "unknown-input-key",
          at: `inputs.${key}`,
          message: `Input "${key}" does not name a modifier in resolutionOrder.`,
        });
        continue;
      }
      if (typeof value !== "string") {
        documentErrors.push({
          kind: "invalid-input-value",
          at: `inputs.${key}`,
          message: `Input values MUST be strings; "${key}" is ${typeof value}.`,
        });
      }
    }
  }

  // ── Merge (§6.2), then aliases (§6.3) via the format-module pipeline.
  let mergedTree: Rec = {};
  for (const entry of entries) {
    const tree =
      entry.kind === "set"
        ? mergeSources(entry.def.sources, entry.at, false)
        : modifierTree(entry, inputByLowerName);
    mergedTree = deepMergeGroup(mergedTree, tree, MERGE_OPTIONS);
  }

  const tokens = resolveTokens(mergedTree);
  return { tokens, mergedTree, documentErrors, tokenErrors: tokens.errors };

  // ────────────────────────────────────────────────────────────────────

  // Pick the context named by the input (or the default) and merge it.
  function modifierTree(entry: OrderEntry, byLowerName: Map<string, unknown>): Rec {
    const contexts = isPlainObject(entry.def.contexts) ? entry.def.contexts : {};
    const keys = Object.keys(contexts);
    if (keys.length === 0) return {};

    const supplied = byLowerName.get(entry.name.toLowerCase());
    const fallback = entry.def.default;
    const wanted = typeof supplied === "string" ? supplied : fallback;

    if (typeof wanted !== "string") {
      if (supplied === undefined) {
        documentErrors.push({
          kind: "missing-required-input",
          at: entry.at,
          message: `Modifier "${entry.name}" declares no default, so an input is required.`,
        });
      }
      return {};
    }

    const key = keys.find((k) => k.toLowerCase() === wanted.toLowerCase());
    if (key === undefined) {
      documentErrors.push({
        kind: "invalid-input-value",
        at: `inputs.${entry.name}`,
        message: `"${wanted}" is not a context of modifier "${entry.name}"; expected one of ${keys.join(", ")}.`,
      });
      return {};
    }
    return mergeSources(contexts[key], `${entry.at}.contexts.${key}`, true);
  }

  // Merge an array of token sources in order — last occurrence wins (§4.1.4).
  function mergeSources(
    sources: unknown,
    at: string,
    fromModifier: boolean,
    stack: Set<string> = new Set(),
  ): Rec {
    if (!Array.isArray(sources)) return {};
    let out: Rec = {};
    sources.forEach((source, i) => {
      const tree = sourceTree(source, `${at}[${i}]`, fromModifier, stack);
      out = deepMergeGroup(out, tree, MERGE_OPTIONS);
    });
    return out;
  }

  // Resolve one source to a tokens tree. A source is an inline tokens
  // document, a reference to one, or a reference to a set (whose own
  // sources are merged in turn).
  function sourceTree(
    source: unknown,
    at: string,
    fromModifier: boolean,
    stack: Set<string>,
  ): Rec {
    if (!isPlainObject(source)) return {};

    if (typeof source.$ref === "string") {
      const pointer = source.$ref;
      if (stack.has(pointer)) {
        documentErrors.push({
          kind: "ref-cycle",
          at,
          message: `Reference cycle detected through ${pointer}.`,
          target: pointer,
        });
        return {};
      }
      if (pointer.startsWith("#/resolutionOrder")) {
        documentErrors.push({
          kind: "invalid-pointer",
          at,
          message: "A reference MUST NOT point into resolutionOrder.",
          target: pointer,
        });
        return {};
      }
      if (pointer.startsWith("#/modifiers/")) {
        // §4.2.1: only resolutionOrder may reference a modifier.
        documentErrors.push({
          kind: "invalid-reference-target",
          at,
          message: `A ${fromModifier ? "modifier" : "set"} MUST NOT reference a modifier (${pointer}).`,
          target: pointer,
        });
        return {};
      }

      const target = dereference(pointer, at);
      if (target === undefined) return {};

      const { $ref: _ref, ...overrides } = source;
      const next = new Set(stack);
      next.add(pointer);
      const merged = isPlainObject(target)
        ? // Sibling keys override the target shallowly (§4.2).
          { ...target, ...overrides }
        : target;
      return sourceTree(merged, at, fromModifier, next);
    }

    if (isPlainObject(source.contexts)) {
      documentErrors.push({
        kind: "invalid-reference-target",
        at,
        message: "A set or modifier source MUST NOT resolve to a modifier.",
      });
      return {};
    }

    // A referenced set contributes its own sources, merged in order.
    if (Array.isArray(source.sources)) {
      return mergeSources(source.sources, at, fromModifier, stack);
    }

    return source;
  }

  // Same-document pointers resolve against the resolver document; anything
  // else needs a pre-parsed entry in `options.externalDocuments`.
  function dereference(pointer: string, at: string): unknown {
    const hash = pointer.indexOf("#");
    const uri = hash === -1 ? pointer : pointer.slice(0, hash);
    const fragment = hash === -1 ? "" : pointer.slice(hash);

    let root: unknown;
    if (uri === "") {
      root = doc;
    } else if (Object.prototype.hasOwnProperty.call(external, uri)) {
      root = external[uri];
    } else {
      documentErrors.push({
        kind: "invalid-pointer",
        at,
        message: `No external document supplied for "${uri}".`,
        target: pointer,
      });
      return undefined;
    }

    const resolved = fragment === "" || fragment === "#" ? root : jsonPointerGet(root, fragment);
    if (resolved === undefined) {
      documentErrors.push({
        kind: "invalid-pointer",
        at,
        message: `${pointer} does not resolve to a value.`,
        target: pointer,
      });
    }
    return resolved;
  }
}

function emptyResult(documentErrors: ResolverModuleError[]): ResolvedResolverDocument {
  const tokens = resolveTokens({});
  return { tokens, mergedTree: {}, documentErrors, tokenErrors: tokens.errors };
}
