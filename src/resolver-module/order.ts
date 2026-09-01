// The §6.2 ordering pass, split out from `resolveResolverDocument` so it can
// run once and be reused across many input combinations.
//
// Validating the document and walking `resolutionOrder` is input-independent:
// nothing here depends on which context a modifier is set to. Resolving a
// document at N permutations therefore re-runs arktype N times unless this
// pass is hoisted — which, for a document of any size, dominates the cost of
// the merge itself.
import { type } from "arktype";
import { ResolverDocument } from "./schema.ts";
import type { ResolverModuleError } from "./types.ts";

type Rec = Record<string, unknown>;

// resolutionOrder entries may only reference a named set or modifier.
const ORDER_REF_RE = /^#\/(sets|modifiers)\/([^/]+)$/;

function isPlainObject(value: unknown): value is Rec {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/**
 * An entry of `resolutionOrder`, after refs are followed and inline
 * definitions are unwrapped.
 */
export type OrderEntry = {
  name: string;
  kind: "set" | "modifier";
  def: Rec;
  /** True when the entry was declared inline rather than referenced. */
  inline: boolean;
  /** Document location used as the `at` of any error this entry raises. */
  at: string;
};

export type ResolutionOrder = {
  /** The schema-validated document, or `undefined` when validation failed. */
  doc: Rec | undefined;
  entries: OrderEntry[];
  /**
   * Input-independent diagnostics: schema failures, bad pointers, duplicate
   * names, modifier structure. Callers that resolve repeatedly must copy this
   * rather than push onto it.
   */
  errors: ResolverModuleError[];
};

/**
 * Validate a resolver document and resolve every `resolutionOrder` entry to a
 * concrete set or modifier definition (§6.2), reporting reference, naming and
 * modifier-structure errors along the way.
 *
 * Never throws: a document the schema rejects yields `doc: undefined`, no
 * entries, and one `invalid-document` error per arktype issue.
 */
export function buildResolutionOrder(document: unknown): ResolutionOrder {
  const errors: ResolverModuleError[] = [];

  const parsed = ResolverDocument(document);
  if (parsed instanceof type.errors) {
    for (const issue of [...parsed]) {
      errors.push({
        kind: "invalid-document",
        at: issue.path.map(String).join(".") || "(root)",
        message: issue.message,
      });
    }
    return { doc: undefined, entries: [], errors };
  }

  const doc = parsed as unknown as Rec;
  const namedSets = isPlainObject(doc.sets) ? doc.sets : {};
  const namedModifiers = isPlainObject(doc.modifiers) ? doc.modifiers : {};
  const order = Array.isArray(doc.resolutionOrder) ? doc.resolutionOrder : [];

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
        errors.push({
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
        errors.push({
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
        errors.push({
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
      errors.push({
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
    if (isPlainObject(def)) checkModifier(def, `modifiers.${key}`, errors);
  }
  for (const entry of entries) {
    if (entry.kind === "modifier" && entry.inline) {
      checkModifier(entry.def, entry.at, errors);
    }
  }

  return { doc, entries, errors };
}

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

/**
 * A modifier as seen by a consumer building a UI over the document: its
 * effective name, its contexts in declaration order, and its metadata.
 */
export type ResolverModifierInfo = {
  /**
   * The resolutionOrder-effective name — a `$ref` entry carrying a sibling
   * `name` is renamed. This is the key an input must use, and the only name
   * `resolveResolverDocument` will accept without raising `unknown-input-key`.
   */
  name: string;
  /** Context names in declaration order. */
  contexts: string[];
  default?: string;
  description?: string;
  $extensions?: Rec;
};

/**
 * The modifiers reachable through `resolutionOrder`, in order.
 *
 * Deliberately *not* `Object.keys(document.modifiers)`: a modifier that is
 * declared but never referenced contributes nothing, and passing its name as
 * an input raises `unknown-input-key`. Enumerating from the order is the only
 * way to get a list whose names are valid inputs.
 *
 * Never throws; returns `[]` for a document the schema rejects.
 */
export function resolverModifiers(document: unknown): ResolverModifierInfo[] {
  const { entries } = buildResolutionOrder(document);
  const out: ResolverModifierInfo[] = [];

  for (const entry of entries) {
    if (entry.kind !== "modifier") continue;
    const contexts = isPlainObject(entry.def.contexts) ? entry.def.contexts : {};
    out.push({
      name: entry.name,
      contexts: Object.keys(contexts),
      default: typeof entry.def.default === "string" ? entry.def.default : undefined,
      description:
        typeof entry.def.description === "string" ? entry.def.description : undefined,
      $extensions: isPlainObject(entry.def.$extensions) ? entry.def.$extensions : undefined,
    });
  }

  return out;
}
