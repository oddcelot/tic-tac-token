"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Token = exports.StrokeStyle = exports.Stroke = exports.Shadow = exports.Number = exports.CubicBezier = exports.Duration = exports.FontSize = exports.FontWeight = exports.FontWeightAliasNames = exports.FontWeightAliasMap = exports.FontFamily = exports.Dimension = exports.Color = exports.NumberValue = void 0;
var arktype_1 = require("arktype");
exports.NumberValue = (0, arktype_1.type)({ value: "number", unit: "'rem' | 'px'" });
exports.Color = (0, arktype_1.type)({
    $type: "'color'",
    $value: {
        colorSpace: "'srgb' | 'srgb-linear' | 'hsl' | 'hwb' | 'lab' | 'lch' | 'oklab' | 'oklch' | 'display-p3' | 'a98-rgb' | 'prophoto-rgb' | 'rec2020' | 'xzy-d65' | 'xyz-d50'",
        components: (0, arktype_1.type)(["number | 'none'", "number | 'none'", "number | 'none'"]),
        alpha: "(0 <= number <= 1)?",
        hex: "string.hex?",
    },
});
exports.Dimension = (0, arktype_1.type)({
    $type: "'dimension'",
    /** `px` needs to be convered to `dp` on Android and `pt` on iOS  | `1rem` on Android is eqilvalent to `16sp` */
    $value: exports.NumberValue,
});
exports.FontFamily = (0, arktype_1.type)({
    $type: "'fontFamily'",
    $value: "string | string[]",
});
exports.FontWeightAliasMap = {
    100: "'thin' | 'hairline'",
    200: "'extra-light' | 'ultra-light'",
    300: "'light'",
    400: "'normal' | 'regular' | 'book'",
    500: "'medium'",
    600: "'semi-bold' | 'demi-bold'",
    700: "'bold'",
    800: "'extra-bold' | 'ultra-bold'",
    900: "'black' | 'heavy'",
    950: "'extra-black' | 'ultra-black'",
};
var eh = Object.values(exports.FontWeightAliasMap);
exports.FontWeightAliasNames = arktype_1.type.enumerated(Object.values(exports.FontWeightAliasMap));
exports.FontWeight = (0, arktype_1.type)({
    $type: "'fontWeight'",
    $value: (0, arktype_1.type)("1 <= number <= 1000").or(exports.FontWeightAliasNames),
});
exports.FontSize = (0, arktype_1.type)({
    $type: "'fontSize'",
    $value: "number | string",
});
exports.Duration = (0, arktype_1.type)({
    $type: "'duration'",
    $value: {
        value: "number.integer",
        unit: "'ms' | 's'",
    },
});
exports.CubicBezier = (0, arktype_1.type)({
    $type: "'cubicBezier'",
    $value: (0, arktype_1.type)(["0 <= number <= 1", "number", "0 <= number <= 1", "number"]),
});
exports.Number = (0, arktype_1.type)({
    $type: "'number'",
    $value: "number",
});
exports.Shadow = (0, arktype_1.type)({
    $type: "'shadow'",
    $value: {
        color: exports.Color,
        offsetX: exports.NumberValue,
        offsetY: exports.NumberValue,
        blur: exports.NumberValue,
        spread: exports.NumberValue,
    },
});
exports.Stroke = (0, arktype_1.type)({
    $type: "'stroke'",
    $value: "'none' | 'hidden' | 'dotted' | 'dashed' | 'solid' | 'double' | 'groove' | 'ridge' | 'inset' | 'outset'",
});
exports.StrokeStyle = (0, arktype_1.type)({
    $type: "'strokeStyle'",
    $value: {
        dashArray: [exports.NumberValue, exports.NumberValue],
        lineCap: "'round'",
    },
});
exports.Token = exports.Color.or(exports.Dimension)
    .or(exports.FontFamily)
    .or(exports.FontSize)
    .or(exports.FontWeight)
    .or(exports.Duration)
    .or(exports.CubicBezier)
    .or(exports.Number)
    .or(exports.Shadow)
    .or(exports.Stroke)
    .or(exports.StrokeStyle)
    .and((0, arktype_1.type)({
    description: "string?",
}));
var exampleToken = {
    description: "some description",
    $type: "color",
    $value: {
        colorSpace: "srgb",
        components: [1, 1, 1],
        alpha: 213,
        hex: "#000000",
    },
};
