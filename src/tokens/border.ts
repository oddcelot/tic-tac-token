import { type } from "arktype";
import { ColorValue } from "./color.ts";
import { DimensionValue } from "./dimension.ts";
import { ValueAlias } from "./shared.ts";
import { StrokeStyleValue } from "./strokeStyle.ts";

export const Border = type({
  $type: "'border'",
  $value: ValueAlias.or(
    type({
      color: ColorValue,
      width: DimensionValue,
      style: StrokeStyleValue,
    }).onUndeclaredKey("reject"),
  ),
}).describe("Border");
