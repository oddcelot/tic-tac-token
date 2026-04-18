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
import { CommonMetadata, Extensions, ValueAlias } from "./tokens/shared.ts";
import { Shadow } from "./tokens/shadow.ts";
import { StrokeStyle } from "./tokens/strokeStyle.ts";
import { Transition } from "./tokens/transition.ts";
import { Typography } from "./tokens/typography.ts";

export const TokenTypeName = type(
  "'color' | 'dimension' | 'fontFamily' | 'fontWeight' | 'duration' | 'cubicBezier' | 'number' | 'strokeStyle' | 'border' | 'transition' | 'shadow' | 'gradient' | 'typography'",
);

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
  .onUndeclaredKey("reject");

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
