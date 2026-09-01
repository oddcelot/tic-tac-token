import { type } from "arktype";
import { deepMergeGroup } from "../resolver/extends.ts";
import { resolveTokens } from "../resolver/index.ts";
import { jsonPointerGet } from "../resolver/json-pointer.ts";
import { ResolverDocument } from "./schema.ts";
import type {
  ResolvedResolverDocument,
  ResolveResolverOptions,
  ResolverInputs,
  ResolverModuleError,
} from "./types.ts";

export { ResolverDocument, SetDef, ModifierDef } from "./schema.ts";
export type {
  ResolverModuleError,
  ResolverModuleErrorKind,
  ResolverInputs,
  ResolveResolverOptions,
  ResolvedResolverDocument,
} from "./types.ts";

type Rec = Record<string, unknown>;

// resolutionOrder entries may only reference a named set or modifier.
const ORDER_REF_RE = /^#\/(sets|modifiers)\/([^/]+)$/;

// Sources are independent documents, so a `$extends` inside one is content
// to preserve, not an inheritance link to consume.
const MERGE_OPTIONS = { keepExtends: true } as const;

function isPlainObject(value: unknown): value is Rec {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

// An entry of resolutionOrder, after refs are followed and inline
// definitions are unwrapped.
type OrderEntry = {
  name: string;
  kind: "set" | "modifier";
  def: Rec;
  /** True when the entry was declared inline rather than referenced. */
  inline: boolean;
  /** Document location used as the `at` of any error this entry raises. */
  at: string;
};

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
  const documentErrors: ResolverModuleError[] = [];
  const external = options.externalDocuments ?? {};

  const parsed = ResolverDocument(document);
  if (parsed instanceof type.errors) {
    for (const issue of [...parsed]) {
      documentErrors.push({
        kind: "invalid-document",
        at: issue.path.map(String).join(".") || "(root)",
        message: issue.message,
      });
    }
    return emptyResult(documentErrors);
  }

  const doc = parsed as unknown as Rec;
  const namedSets = isPlainObject(doc.sets) ? doc.sets : {};
  const namedModifiers = isPlainObject(doc.modifiers) ? doc.modifiers : {};
  const order = Array.isArray(doc.resolutionOrder) ? doc.resolutionOrder : [];

  // ── Ordering (§6.2): resolve every resolutionOrder entry to a named
  // set or modifier definition, reporting reference and naming errors.
  const entries: OrderEntry[] = [];
  const seenNames = new Set<string>();

  order.forEach((raw, index) => {
    const at = `resolutionOrder[${index}]`;
    if (!isPlainObject(raw)) return;

    let name: string | undefined;
    let kind: "set" | "modifier" | undefined;
    let def: Rec | undefined;
    let inline = false;

    if (typeof raw.$ref === "string") {
      const match = raw.$ref.match(ORDER_REF_RE);
      if (!match) {
        documentErrors.push({
          kind: "invalid-pointer",
          at,
          message: `resolutionOrder may only reference #/sets/<name> or #/modifiers/<name>; got ${raw.$ref}.`,
          target: raw.$ref,
        });
        return;
      }
      const [, section, key] = match as unknown as [string, string, string];
      const pool = section === "sets" ? namedSets : namedModifiers;
      const target = pool[key];
      if (!isPlainObject(target)) {
        documentErrors.push({
          kind: "invalid-pointer",
          at,
          message: `${raw.$ref} does not resolve to a declared ${section === "sets" ? "set" : "modifier"}.`,
          target: raw.$ref,
        });
        return;
      }
      kind = section === "sets" ? "set" : "modifier";
      // Keys alongside $ref shallow-override the target (§4.2).
      const { $ref: _ref, name: refName, ...overrides } = raw;
      def = { ...target, ...overrides };
      name = typeof refName === "string" ? refName : key;
    } else {
      if (typeof raw.name !== "string" || typeof raw.type !== "string") {
        documentErrors.push({
          kind: "missing-name-or-type",
          at,
          message:
            "An inline resolutionOrder entry MUST declare both `name` and `type`.",
        });
        return;
      }
      name = raw.name;
      kind = raw.type as "set" | "modifier";
      inline = true;
      const { name: _n, type: _t, ...rest } = raw;
      def = rest;
    }

    if (seenNames.has(name)) {
      documentErrors.push({
        kind: "duplicate-name",
        at,
        message: `Duplicate resolutionOrder name "${name}".`,
      });
      return;
    }
    seenNames.add(name);
    entries.push({ name, kind, def, inline, at });
  });

  // ── Modifier structure (§4.1.5.1). Named modifiers are checked whether
  // or not resolutionOrder uses them; inline ones are checked in place.
  for (const [key, def] of Object.entries(namedModifiers)) {
    if (isPlainObject(def)) checkModifier(def, `modifiers.${key}`, documentErrors);
  }
  for (const entry of entries) {
    if (entry.kind === "modifier" && entry.inline) {
      checkModifier(entry.def, entry.at, documentErrors);
    }
  }

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

  function checkModifier(def: Rec, at: string, sink: ResolverModuleError[]): void {
    const contexts = isPlainObject(def.contexts) ? def.contexts : undefined;
    const keys = contexts ? Object.keys(contexts) : [];
    if (keys.length === 0) {
      sink.push({
        kind: "modifier-no-contexts",
        at,
        message: "A modifier MUST declare at least one context.",
      });
      return;
    }
    if (keys.length === 1) {
      sink.push({
        kind: "modifier-single-context",
        at,
        message:
          "A modifier SHOULD declare two or more contexts; one is equivalent to a set.",
      });
    }
    if (typeof def.default === "string" && !keys.includes(def.default)) {
      sink.push({
        kind: "invalid-default",
        at,
        message: `Modifier default "${def.default}" is not one of its contexts.`,
      });
    }
  }

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
