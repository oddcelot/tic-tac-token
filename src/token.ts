import { scope, type } from "arktype";
import { Border, BorderValue } from "./tokens/border.ts";
import { Color, ColorValue } from "./tokens/color.ts";
import { CubicBezier, CubicBezierValue } from "./tokens/cubicBezier.ts";
import { Dimension, DimensionValue } from "./tokens/dimension.ts";
import { Duration, DurationValue } from "./tokens/duration.ts";
import { FontFamily, FontFamilyValue } from "./tokens/fontFamily.ts";
import { FontWeight, FontWeightValue } from "./tokens/fontWeight.ts";
import { Gradient, GradientValue } from "./tokens/gradient.ts";
import { Number, NumberLiteralValue } from "./tokens/number.ts";
import {
  CommonMetadata,
  Extensions,
  JsonPointerRef,
  ValueAlias,
} from "./tokens/shared.ts";
import { Shadow, ShadowValue } from "./tokens/shadow.ts";
import { StrokeStyle, StrokeStyleValue } from "./tokens/strokeStyle.ts";
import { Transition, TransitionValue } from "./tokens/transition.ts";
import { Typography, TypographyValue } from "./tokens/typography.ts";

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

// A typeless token: $type is absent (for group-level $type inheritance) so
// $value is matched against the union of all value shapes. Mirrors the
// fallback branch in DTCG 2025.10 format/token.json when neither $type
// nor a ref is present. NOTE: the DTCG prose says "tools MUST NOT guess
// type from value shape"; the canonical JSON Schema nevertheless
// implements this fallback. We follow the schema.
const AnyValue = ColorValue.or(DimensionValue)
  .or(FontFamilyValue)
  .or(FontWeightValue)
  .or(DurationValue)
  .or(CubicBezierValue)
  .or(NumberLiteralValue)
  .or(ShadowValue)
  .or(StrokeStyleValue)
  .or(BorderValue)
  .or(TransitionValue)
  .or(GradientValue)
  .or(TypographyValue);

const TypelessToken = type({ $value: AnyValue });

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
