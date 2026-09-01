import { type } from "arktype";
import { Group } from "../token.ts";
import { Extensions } from "../tokens/shared.ts";

// DTCG 2025.10 resolver §4.2. Two differences from the format module's
// reference object: keys alongside `$ref` are legal (they shallow-override
// the target), and the pointer isn't constrained to `#/` — §4.2 requires
// same-document support but leaves other URI types to the tool, so a
// pointer at an external document has to survive validation and be judged
// at resolution time, where it produces a precise `invalid-pointer`.
export const ResolverRefObject = type({
  $ref: "string",
  "[string]": "unknown",
});

// A source is either an inline tokens document or a reference to one (or
// to a set, which a modifier context may pull in).
export const TokenSource = ResolverRefObject.or(Group);

export const SetDef = type({
  sources: TokenSource.array(),
  "description?": "string",
  "$extensions?": Extensions,
}).onUndeclaredKey("reject");

export const ModifierDef = type({
  contexts: type({ "[string]": TokenSource.array() }),
  "default?": "string",
  "description?": "string",
  "$extensions?": Extensions,
}).onUndeclaredKey("reject");

// Inline resolutionOrder entries. `name` and `type` are required by the
// spec but declared optional here on purpose: the runtime pass reports a
// precise `missing-name-or-type` per offending index, which a schema
// rejection would flatten into one undifferentiated `invalid-document`.
export const InlineEntry = type({
  "name?": "string",
  "type?": "'set' | 'modifier'",
  "sources?": TokenSource.array(),
  "contexts?": type({ "[string]": TokenSource.array() }),
  "default?": "string",
  "description?": "string",
  "$extensions?": Extensions,
}).onUndeclaredKey("reject");

export const ResolutionOrderEntry = ResolverRefObject.or(InlineEntry);

export const ResolverDocument = type({
  // §4.1: MUST be present and MUST be this exact version.
  version: "'2025.10'",
  resolutionOrder: ResolutionOrderEntry.array(),
  "name?": "string",
  "description?": "string",
  "$schema?": "string",
  "sets?": type({ "[string]": SetDef }),
  "modifiers?": type({ "[string]": ModifierDef }),
  // §4.1: tools MUST NOT error on `$defs`; ignored if unsupported.
  "$defs?": "unknown",
  "$extensions?": Extensions,
}).onUndeclaredKey("reject");

export type ResolverDocument = typeof ResolverDocument.infer;
