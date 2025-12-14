import { writeFileSync } from "node:fs";
import { z } from "zod";

z.object({
  name: z.string(),
  birth_year: z.number().optional(),
});

export const FontWeightAliasMap = z.object({
  100: z.union([z.literal("thin"), z.literal("hairline")]),
  200: z.union([z.literal("extra-light"), z.literal("ultra-light")]),
  300: z.union([z.literal("light")]),
  400: z.union([z.literal("normal"), z.literal("regular"), z.literal("book")]),
  500: z.union([z.literal("medium")]),
  600: z.union([z.literal("semi-bold"), z.literal("demi-bold")]),
  700: z.union([z.literal("bold")]),
  800: z.union([z.literal("extra-bold"), z.literal("ultra-bold")]),
  900: z.union([z.literal("black"), z.literal("heavy")]),
  950: z.union([z.literal("extra-black"), z.literal("ultra-black")]),
});

export const FontWeightAlias = {
  100: ["thin", "hairline"],
  200: ["extra-light", "ultra-light"],
  300: ["light"],
  400: ["normal", "regular", "book"],
  500: ["medium"],
  600: ["semi-bold", "demi-bold"],
  700: ["bold"],
  800: ["extra-bold", "ultra-bold"],
  900: ["black", "heavy"],
  950: ["extra-black", "ultra-black"],
};

const TokenType = z.union([
  z.literal("fontWeight"),
  z.literal("fontSize"),
  z.literal("number"),
]);

const ValueAlias = z.templateLiteral(["{", z.string().min(1), "}"]);

const FontWeightToken = z.object({
  $type: z.literal("fontWeight"),
  $value: z.union([
    ValueAlias,
    z.number().min(1).max(1000),
    z.enum(FontWeightAlias.values().flatMap()),
  ]),
});

type FontWeightToken = z.infer<typeof FontWeightToken>;

const testFontWeightToken: FontWeightToken = {
  $type: "fontWeight",
  $value: "bold",
};

const GeneralToken = z.object({
  $type: TokenType,
  $value: z.any(),
});

// const MyResult = z.discriminatedUnion("status", [
//   // simple literal
//   z.object({ status: z.literal("aaa"), data: z.string() }),
//   // union discriminator
//   z.object({ status: z.union([z.literal("bbb"), z.literal("ccc")] }),
//   // pipe discriminator
//   z.object({ status: z.literal("fail").transform(val => val.toUpperCase()) }),
// ]);

// writeFileSync(
//   "schema.json",
//   JSON.stringify(
//     Schema2.toJsonSchema({
//       fallback: {
//         default: (ctx) => ctx.base,
//       },
//     }),
//     null,
//     2,
//   ),
// );
