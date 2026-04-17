# DTCG Format — Compact Reference (2025.10)

> **Version:** Design Tokens Format Module **2025.10** (Draft Community Group Report, 10 April 2026)
> **Status:** Draft / preview. The spec itself says: *"Do not attempt to implement this version."* Treat as a moving target.
> **Sources:**
> - Format: <https://tr.designtokens.org/format/>
> - Color module: <https://tr.designtokens.org/color/>
> - Repo: <https://github.com/design-tokens/community-group>
> - JSON Schema URL (from examples): `https://www.designtokens.org/schemas/2025.10/format.json`

This document is a dense, LLM-oriented reference for validating implementations against the DTCG format. Token-type sections include verbatim `$value` shapes and JSON examples lifted from the spec.

---

## §1 File Format

| Property | Value |
|---|---|
| Media type | `application/design-tokens+json` (preferred, SHOULD support). `application/json` MAY be used; tools MUST accept both. |
| File extension | `.tokens` (preferred) or `.tokens.json` |
| Encoding | JSON per [RFC 8259] |
| Root optional property | `$schema` — points to the JSON Schema URL above |

---

## §2 Tokens vs Groups

- A **token** is any object containing a `$value` property.
- A **group** is any object **without** `$value`. Groups may contain tokens and nested groups.
- An object MUST NOT contain both `$value` and child tokens/groups.
- Groups MAY be empty.
- Reserved token root name `$root`: a group with a `$root` child carries its own token value while still nesting children. Reference with `{group.$root}`; a plain `{group}` reference to a group is invalid.

### Reserved properties

| Property | Token | Group | Value |
|---|---|---|---|
| `$value` | required | — | type-specific |
| `$type` | optional | optional (inherits to children) | one of the spec type strings |
| `$description` | optional | optional | JSON string |
| `$extensions` | optional | optional | object keyed by reverse-DNS vendor keys; tools MUST preserve unknown entries |
| `$deprecated` | optional | optional | `true` / `false` / string explanation |
| `$extends` | — | optional | curly-brace ref to another group (deep-merge inheritance, no cycles) |
| `$ref` | optional | — | RFC 6901 JSON Pointer |

### Name / character restrictions (§5.1.1)

Token and group names:

- MUST be valid JSON strings.
- MUST NOT begin with `$` (reserved prefix; exceptions are the reserved keywords like `$root`).
- MUST NOT contain `{`, `}`, or `.` anywhere.
- Case-sensitive; tools MAY warn on case-only duplicates.

---

## §3 `$type` Resolution (§5.2.2)

Precedence when a token is evaluated:

1. Token's own `$type`.
2. Resolved group's `$type` (after `$extends` resolution).
3. Walk up parent groups until a `$type` is found.
4. If the token is a reference, use the target's type.
5. Otherwise → **invalid token**. Tools MUST NOT guess from the value's shape.

`$type` strings are case-sensitive. Valid types:

- **Basic:** `color`, `dimension`, `fontFamily`, `fontWeight`, `duration`, `cubicBezier`, `number`
- **Composite:** `strokeStyle`, `border`, `transition`, `shadow`, `gradient`, `typography`

There is **no** `fontSize`, `string`, `boolean`, `percentage`, `ratio`, or `file` type in 2025.10.

---

## §4 Aliases and References (§7)

Two syntaxes, both MUST be supported.

### 4.1 Curly-brace alias `"{group.token}"`

- Path-dotted. Names separated by `.` (names can't contain `.`).
- ALWAYS resolves to the target's `$value` (implicit `/$value` append).
- Targets complete tokens only. Cannot address array indices, sub-properties, or groups (except via `$root`).
- Used as a whole-string `$value`, or embedded inside composite sub-values.

Example:

```json
{ "$type": "color", "$value": "{colors.accent}" }
```

### 4.2 JSON Pointer `$ref` (RFC 6901)

- Can target any document location (sub-properties, array indices, metadata).
- Escape: `~` → `~0`, `/` → `~1`.
- Replaces the entire token/value object at the location where it appears.

Example:

```json
{ "$type": "color", "$ref": "#/colors/blue/$value" }
```

### 4.3 Group inheritance `$extends`

- Group-only property: `"$extends": "{otherGroup}"`.
- Deep-merge semantics: inherited tokens are present in the extending group; locally defined tokens at the same path **completely replace** (not merge) the inherited ones; new paths are added.
- MUST NOT reference a token; group only. MUST NOT be circular.

### 4.4 Resolution rules

- Chained aliases MUST be followed until a concrete value is reached.
- **Circular references MUST be detected and reported** (applies to `{}` aliases, `$extends`, and `$ref`).
- References SHOULD be preserved in memory and resolved on demand.
- Property-level references (e.g. reusing one color channel) are only possible via `$ref`, not curly-brace.

---

## §5 Basic Types

### 5.1 `color` (§8.1 + Color Module)

`$value` is an object:

```json
{
  "colorSpace": "srgb",
  "components": [1, 0, 1],
  "alpha": 1,
  "hex": "#ff00ff"
}
```

| Field | Required | Shape |
|---|---|---|
| `colorSpace` | yes | one of 14 enum values below |
| `components` | yes | array. Length depends on colorSpace (always 3 today). Each element: a **number** OR the literal string `"none"` (missing/undefined, distinct from `0` when interpolating). |
| `alpha` | no | number `[0, 1]`. Default `1`. |
| `hex` | no | `#RRGGBB` — **exactly 6 hex digits** (no 3-digit or 8-digit form; avoids collision with alpha). Fallback representation only. |

**Color spaces & component ranges** (`[]` inclusive, `()` exclusive):

| `colorSpace` | Components | Ranges |
|---|---|---|
| `srgb` | [R, G, B] | each `[0, 1]` |
| `srgb-linear` | [R, G, B] | each `[0, 1]` |
| `hsl` | [H, S, L] | H `[0, 360)`, S `[0, 100]`, L `[0, 100]` |
| `hwb` | [H, W, B] | H `[0, 360)`, W/B `[0, 100]` |
| `lab` | [L, a, b] | L `[0, 100]`, a/b unbounded (≈ `[-160, 160]`) |
| `lch` | [L, C, H] | L `[0, 100]`, C `[0, ∞)` (≈ ≤230), H `[0, 360)` |
| `oklab` | [L, a, b] | L `[0, 1]`, a/b unbounded (≈ ±0.5) |
| `oklch` | [L, C, H] | L `[0, 1]`, C `[0, ∞)` (≈ ≤0.5), H `[0, 360)` |
| `display-p3` | [R, G, B] | each `[0, 1]` |
| `a98-rgb` | [R, G, B] | each `[0, 1]` |
| `prophoto-rgb` | [R, G, B] | each `[0, 1]` |
| `rec2020` | [R, G, B] | each `[0, 1]` |
| `xyz-d65` | [X, Y, Z] | each `[0, 1]` |
| `xyz-d50` | [X, Y, Z] | each `[0, 1]` |

There is **no CSS-string form** for color `$value` (no `"#ff0000"`, no `"rgb(...)"`, no `"hsl(...)"` as a value). The `hex` field inside the object is a fallback, not the primary form.

### 5.2 `dimension` (§8.2)

```json
{ "value": 0.5, "unit": "rem" }
```

| Field | Required | Shape |
|---|---|---|
| `value` | yes | number (integer or float) |
| `unit` | yes | `"px"` or `"rem"` only |

Both fields are required even when `value` is `0`.

### 5.3 `fontFamily` (§8.3)

`$value` is a string (single family) or an array of strings (ordered fallback stack):

```json
{ "$type": "fontFamily", "$value": "Comic Sans MS" }
{ "$type": "fontFamily", "$value": ["Helvetica", "Arial", "sans-serif"] }
```

### 5.4 `fontWeight` (§8.4)

`$value` is either:

- a **number in `[1, 1000]`** (integer or float), OR
- one of the predefined string aliases below (case-sensitive, hyphenated).

| Numeric | Aliases |
|---|---|
| 100 | `thin`, `hairline` |
| 200 | `extra-light`, `ultra-light` |
| 300 | `light` |
| 400 | `normal`, `regular`, `book` |
| 500 | `medium` |
| 600 | `semi-bold`, `demi-bold` |
| 700 | `bold` |
| 800 | `extra-bold`, `ultra-bold` |
| 900 | `black`, `heavy` |
| 950 | `extra-black`, `ultra-black` |

Out-of-range numbers and any other strings (including case variants) MUST be rejected.

### 5.5 `duration` (§8.5)

```json
{ "value": 100, "unit": "ms" }
{ "value": 1.5, "unit": "s" }
```

| Field | Required | Shape |
|---|---|---|
| `value` | yes | number (integer or float — **not integer-only**) |
| `unit` | yes | `"ms"` or `"s"` only |

### 5.6 `cubicBezier` (§8.6)

`$value` is an array of **exactly four** numbers `[P1x, P1y, P2x, P2y]`:

```json
{ "$type": "cubicBezier", "$value": [0.5, 0, 1, 1] }
```

- `P1x`, `P2x` ∈ `[0, 1]`
- `P1y`, `P2y` are any real numbers

### 5.7 `number` (§8.7)

`$value` is a plain JSON number (int or float, positive or negative). Used for unitless line heights, gradient stop positions, etc.

---

## §6 Composite Types (§9)

Each composite sub-value may be either an inline value OR an alias to a token of the matching sub-type. Arrays may mix inline elements and refs; refs in arrays always resolve to single elements (no flattening).

### 6.1 `strokeStyle` (§9.3)

`$value` is **either** a string enum **or** an object — not both.

String enum (CSS semantics):

```
"solid" | "dashed" | "dotted" | "double" | "groove" | "ridge" | "outset" | "inset"
```

Object form:

```json
{
  "dashArray": [
    { "value": 0.5, "unit": "rem" },
    { "value": 0.25, "unit": "rem" }
  ],
  "lineCap": "round"
}
```

- `dashArray`: array of dimension values OR refs to `dimension` tokens. Alternating dash/gap lengths. Odd counts are logically duplicated to even.
- `lineCap`: `"round" | "butt" | "square"` (SVG semantics).

### 6.2 `border` (§9.4)

```json
{
  "color":  { "colorSpace": "srgb", "components": [0.218, 0.218, 0.218] },
  "width":  { "value": 3, "unit": "px" },
  "style":  "solid"
}
```

- `color`: color value or ref to `color` token.
- `width`: dimension value or ref to `dimension` token.
- `style`: strokeStyle value (string enum or object) or ref to `strokeStyle` token.

### 6.3 `transition` (§9.5)

```json
{
  "duration":       { "value": 200, "unit": "ms" },
  "delay":          { "value": 0,   "unit": "ms" },
  "timingFunction": [0.5, 0, 1, 1]
}
```

- `duration`: duration value or ref.
- `delay`: duration value or ref.
- `timingFunction`: cubicBezier value or ref.

### 6.4 `shadow` (§9.6)

`$value` is **either a single shadow object or an array** of shadow objects / refs to `shadow` tokens.

Single shadow:

```json
{
  "color":   { "colorSpace": "srgb", "components": [0, 0, 0], "alpha": 0.5 },
  "offsetX": { "value": 0.5, "unit": "rem" },
  "offsetY": { "value": 0.5, "unit": "rem" },
  "blur":    { "value": 1.5, "unit": "rem" },
  "spread":  { "value": 0,   "unit": "rem" },
  "inset":   true
}
```

- `color`, `offsetX`, `offsetY`, `blur`, `spread`: required; value or ref.
- `inset`: optional boolean. Default `false`. `true` = inner shadow.

Array form allows layered shadows and may mix inline objects with `"{shadow.ref}"` strings.

### 6.5 `gradient` (§9.7)

`$value` is an **array** of gradient stop objects and/or refs to `gradient` tokens:

```json
[
  { "color": { "colorSpace": "srgb", "components": [0, 0, 1] }, "position": 0 },
  { "color": { "colorSpace": "srgb", "components": [1, 0, 0] }, "position": 1 }
]
```

Per-stop:

- `color`: color value or ref to `color` token.
- `position`: number `[0, 1]` or ref to `number` token. Out-of-range values are **clamped** (not rejected): `42` → `1`, `-99` → `0`.

If no stop at `0` or `1`, the nearest stop's color extends to that end. Gradient direction/type (linear/radial/conical) is **not** in 2025.10.

### 6.6 `typography` (§9.8)

```json
{
  "fontFamily":    "Roboto",
  "fontSize":      { "value": 42, "unit": "px" },
  "fontWeight":    700,
  "letterSpacing": { "value": 0.1, "unit": "px" },
  "lineHeight":    1.2
}
```

All five properties appear in the spec schema without "optional" markers:

- `fontFamily`: fontFamily value or ref.
- `fontSize`: dimension value or ref. *(No dedicated `fontSize` type — use `dimension`.)*
- `fontWeight`: fontWeight value or ref.
- `letterSpacing`: dimension value or ref.
- `lineHeight`: number value or ref. Interpreted as a multiplier of `fontSize`.

---

## §7 Validation Edge Cases & Gotchas

- `color.components` length must match the `colorSpace` (always 3 today).
- `color.hex` must be 6-digit `#RRGGBB`. Reject 3-digit (`#fff`) and 8-digit (`#ffffffff`).
- `color.components` may contain the string `"none"` — reject any other string. `0` and `"none"` are semantically different.
- `dimension.unit` strict enum `px | rem`.
- `dimension.value` required even when `0`; `unit` required when `0`.
- `duration.unit` strict enum `ms | s`. `value` is any number, not integer-only.
- `fontWeight` string must exactly match an alias (lowercase, hyphenated). Numeric must be `[1, 1000]`.
- `cubicBezier` array must be length 4. Indices 0 and 2 in `[0, 1]`.
- `gradient.position` out-of-range is **clamped**, not rejected.
- `strokeStyle` cannot mix string and object within one token.
- `shadow` can be single object or array; each element can be an object or `{ref}` string.
- Root `$root` token is addressable via `{group.$root}` — the only exception to the `$`-prefix rule inside a user-defined name.
- Reject name characters `$` (leading), `{`, `}`, `.`.
- `$ref` replaces where placed; curly-brace is a whole-string `$value`. `{foo.bar}` always auto-appends `/$value`.
- Circular-reference detection is required for aliases, `$extends`, and `$ref`.
- Type inheritance from the nearest ancestor group applies unless overridden. A token with no resolvable `$type` is invalid.

---

## §8 Open Issues Affecting Validation

Relevant tickets in <https://github.com/design-tokens/community-group/issues>:

- **#53** FontFamily OS/browser restrictions
- **#98** StrokeStyle (linejoin, miterlimit, dashoffset)
- **#99** Border (outset, border-image, multiple borders)
- **#100** Shadow multi-shadow feedback
- **#101** Gradient type (direction missing)
- **#102** Typography `lineHeight` type
- **#200** Error handling semantics
- **#214** `$alias` explicit property proposal
- **#218** / **#245** / **#368** / **#390** dimension unit debates (`em`, `%`, remove `rem/em`)
- **#228** `colorList` type
- **#232** `textAlignment` type
- **#234** boolean/string type support
- **#239** Array types
- **#249** Root group semantics
- **#250** Layered shadow aliasing
- **#253** Nested-vs-flat ambiguity
- **#265** Semantic versioning of the schema
- **#269** Standardized extensions
- **#342** Simple duration values (unitless)

A `resolver/` module also exists at <https://tr.designtokens.org/resolver/> — out of scope for pure format validation.
