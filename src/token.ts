import { scope, type } from "arktype";
import { Border } from "./tokens/border.ts";
import { Color } from "./tokens/color.ts";
import { CubicBezier } from "./tokens/cubicBezier.ts";
import { Dimension } from "./tokens/dimension.ts";
import { Duration } from "./tokens/duration.ts";
import { FontFamily } from "./tokens/fontFamily.ts";
import { FontWeight } from "./tokens/fontWeight.ts";
import { Gradient } from "./tokens/gradient.ts";
import { Number } from "./tokens/number.ts";
import {
  CommonMetadata,
  Extensions,
  JsonPointerRef,
  ValueAlias,
} from "./tokens/shared.ts";
import { Shadow } from "./tokens/shadow.ts";
import { StrokeStyle } from "./tokens/strokeStyle.ts";
import { Transition } from "./tokens/transition.ts";
import { Typography } from "./tokens/typography.ts";

export const TokenTypeName = type(
  "'color' | 'dimension' | 'fontFamily' | 'fontWeight' | 'duration' | 'cubicBezier' | 'number' | 'strokeStyle' | 'border' | 'transition' | 'shadow' | 'gradient' | 'typography'",
);

// A $ref-only token: per DTCG 2025.10, $ref is the JSON Pointer alternative
// to $value and the two are mutually exclusive. $type is optional here
// because the referenced target's type is authoritative.
const TokenRef = type({
  $ref: JsonPointerRef,
  "$type?": TokenTypeName,
});

// A typeless token: $type is absent (for group-level $type inheritance).
// DTCG 2025.10 prose forbids guessing $type from $value's shape, so the
// validator accepts any $value here and defers shape validation to the
// resolver pass that can see the inherited group $type.
const TypelessToken = type({ $value: "unknown" });

const TokenShape = Color.or(Dimension)
  .or(FontFamily)
  .or(FontWeight)
  .or(Duration)
  .or(CubicBezier)
  .or(Number)
  .or(Shadow)
  .or(StrokeStyle)
  .or(Border)
  .or(Transition)
  .or(Gradient)
  .or(Typography)
  .and(CommonMetadata)
  .onUndeclaredKey("reject")
  .or(TokenRef.and(CommonMetadata).onUndeclaredKey("reject"))
  .or(TypelessToken.and(CommonMetadata).onUndeclaredKey("reject"));

// Reserved $-keys are declared explicitly; user-defined child names must match
// the DTCG token/group name pattern (no $-prefix, no '{', '}', or '.').
// Using a regex-matched index signature here both (a) keeps explicit $-keys
// out of the child-validation path and (b) enforces the name pattern at
// validation time. Keys that match neither path are undeclared and rejected
// via the "+": "reject" meta-key.
//
// NOTE on JSON Schema emission: this scope is cyclic (Group -> GroupOrToken
// -> Group) and arktype's JSON Schema emitter currently throws an internal
// error when a cyclic scope contains a discriminated union (which Color
// does — one branch per colorSpace). Runtime validation works correctly
// here; generate-schema.ts emits a non-cyclic Token shape instead.
const $ = scope({
  Token: TokenShape,
  Group: {
    "+": "reject",
    // $schema is a spec-tolerated (though non-normative) URI reference at the
    // root of a tokens file, see format.json#/properties/$schema. We allow it
    // on any Group for simplicity — a nested group with $schema is harmless.
    "$schema?": "string",
    "$type?": TokenTypeName,
    "$description?": "string",
    "$extensions?": Extensions,
    "$extends?": ValueAlias,
    "$deprecated?": "boolean | string",
    "$root?": "Token",
    "[/^[^${}.][^{}.]*$/]": "GroupOrToken",
  },
  GroupOrToken: "Group | Token",
});

const exported = $.export();
export const Token = exported.Token;
export const Group = exported.Group;

// A DTCG tokens file is structurally a root Group.
export const TokensFile = exported.Group;
