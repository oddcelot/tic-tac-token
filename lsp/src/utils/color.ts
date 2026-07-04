import type { Color } from "vscode-languageserver";

// DTCG 2025.10 color → LSP `Color` (0-1 RGBA floats), for the
// `textDocument/documentColor` provider. Zero runtime dependencies so this
// can run inside a browser Worker bundle.
//
// Conversion math (matrices + transfer functions) is taken verbatim from the
// CSS Color 4 spec's published sample implementation
// (https://drafts.csswg.org/css-color-4/conversions.js), which is itself
// sourced from Bruce Lindbloom's RGB/XYZ matrices and Björn Ottosson's OKLab
// reference implementation (https://bottosson.github.io/posts/oklab/).
// All color spaces route through linear-light values → CIE XYZ → linear
// sRGB → gamma-encoded sRGB, with a Bradford D50→D65 adaptation for the
// spaces (lab/lch, prophoto-rgb) that are natively D50.

type Vec3 = readonly [number, number, number];
type Mat3 = readonly [Vec3, Vec3, Vec3];

function multiply3x3(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ];
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

// --- sRGB gamma transfer (also used by display-p3, which shares it) ---
function srgbToLinear(c: number): number {
  const sign = c < 0 ? -1 : 1;
  const abs = Math.abs(c);
  return abs <= 0.04045 ? c / 12.92 : sign * (((abs + 0.055) / 1.055) ** 2.4);
}
function linearToSrgb(c: number): number {
  const sign = c < 0 ? -1 : 1;
  const abs = Math.abs(c);
  return abs > 0.0031308 ? sign * (1.055 * abs ** (1 / 2.4) - 0.055) : 12.92 * c;
}

// --- other RGB-space transfer functions ---
function a98ToLinear(c: number): number {
  return (c < 0 ? -1 : 1) * Math.abs(c) ** (563 / 256);
}
function prophotoToLinear(c: number): number {
  const sign = c < 0 ? -1 : 1;
  const abs = Math.abs(c);
  return abs <= 16 / 512 ? c / 16 : sign * abs ** 1.8;
}
function rec2020ToLinear(c: number): number {
  return (c < 0 ? -1 : 1) * Math.abs(c) ** 2.4;
}

// --- RGB-space-to-XYZ matrices (D65-relative unless noted) ---
// http://www.brucelindbloom.com/index.html?Eqn_RGB_XYZ_Matrix.html
const LIN_P3_TO_XYZ: Mat3 = [
  [608311 / 1250200, 189793 / 714400, 198249 / 1000160],
  [35783 / 156275, 247089 / 357200, 198249 / 2500400],
  [0 / 1, 32229 / 714400, 5220557 / 5000800],
];
const LIN_A98RGB_TO_XYZ: Mat3 = [
  [573536 / 994567, 263643 / 1420810, 187206 / 994567],
  [591459 / 1989134, 6239551 / 9945670, 374412 / 4972835],
  [53769 / 1989134, 351524 / 4972835, 4929758 / 4972835],
];
const LIN_2020_TO_XYZ: Mat3 = [
  [63426534 / 99577255, 20160776 / 139408157, 47086771 / 278816314],
  [26158966 / 99577255, 472592308 / 697040785, 8267143 / 139408157],
  [0 / 1, 19567812 / 697040785, 295819943 / 278816314],
];
// prophoto-rgb is natively D50; matrix from the CSS Color 4 sample code
// (not expressible as a simple rational, calculated to 64-bit precision).
const LIN_PROPHOTO_TO_XYZ_D50: Mat3 = [
  [0.7977666449006423, 0.13518129740053308, 0.0313477341283922],
  [0.2880748288194013, 0.711835234241873, 0.00008993693872564],
  [0, 0, 0.8251046025104602],
];
const XYZ_TO_LIN_SRGB: Mat3 = [
  [12831 / 3959, -329 / 214, -1974 / 3959],
  [-851781 / 878810, 1648619 / 878810, 36519 / 878810],
  [705 / 12673, -2585 / 12673, 705 / 667],
];
// Bradford chromatic adaptation, D50 → D65.
const D50_TO_D65: Mat3 = [
  [0.955473421488075, -0.02309845494876471, 0.06325924320057072],
  [-0.0283697093338637, 1.0099953980813041, 0.021041441191917323],
  [0.012314014864481998, -0.020507649298898964, 1.330365926242124],
];
// OKLab non-linear-LMS → XYZ (D65). https://bottosson.github.io/posts/oklab/
const OKLAB_TO_LMS_NL: Mat3 = [
  [1, 0.3963377773761749, 0.2158037573099136],
  [1, -0.1055613458156586, -0.0638541728258133],
  [1, -0.0894841775298119, -1.2914855480194092],
];
const LMS_TO_XYZ: Mat3 = [
  [1.2268798758459243, -0.5578149944602171, 0.2813910456659647],
  [-0.0405757452148008, 1.112286803280317, -0.0717110580655164],
  [-0.0763729366746601, -0.4214933324022432, 1.5869240198367816],
];
// CIE Lab reference white, D50 (4-figure chromaticities per the spec).
const D50: Vec3 = [0.3457 / 0.3585, 1, (1 - 0.3457 - 0.3585) / 0.3585];

// XYZ (D65) → gamma-encoded sRGB, shared tail of every non-sRGB conversion.
function xyzD65ToSrgb(xyz: Vec3): Vec3 {
  const lin = multiply3x3(XYZ_TO_LIN_SRGB, xyz);
  return lin.map(linearToSrgb) as unknown as Vec3;
}

function hslToSrgb(h: number, s: number, l: number): Vec3 {
  const hue = ((h % 360) + 360) % 360;
  const sat = s / 100;
  const light = l / 100;
  const f = (n: number): number => {
    const k = (n + hue / 30) % 12;
    const a = sat * Math.min(light, 1 - light);
    return light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}

function hwbToSrgb(h: number, w: number, b: number): Vec3 {
  const white = w / 100;
  const black = b / 100;
  if (white + black >= 1) {
    const gray = white / (white + black);
    return [gray, gray, gray];
  }
  const [r, g, bl] = hslToSrgb(h, 100, 50);
  const scale = 1 - white - black;
  return [r * scale + white, g * scale + white, bl * scale + white];
}

function labToXyzD50(l: number, a: number, b: number): Vec3 {
  const kappa = 24389 / 27;
  const epsilon = 216 / 24389;
  const fy = (l + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;
  const xyz: Vec3 = [
    fx ** 3 > epsilon ? fx ** 3 : (116 * fx - 16) / kappa,
    l > kappa * epsilon ? ((l + 16) / 116) ** 3 : l / kappa,
    fz ** 3 > epsilon ? fz ** 3 : (116 * fz - 16) / kappa,
  ];
  return [xyz[0] * D50[0], xyz[1] * D50[1], xyz[2] * D50[2]];
}

function lchToLab(l: number, c: number, h: number): Vec3 {
  const rad = (h * Math.PI) / 180;
  return [l, c * Math.cos(rad), c * Math.sin(rad)];
}

function oklabToXyzD65(l: number, a: number, b: number): Vec3 {
  const lmsNonLinear = multiply3x3(OKLAB_TO_LMS_NL, [l, a, b]);
  const lms = lmsNonLinear.map((v) => v ** 3) as unknown as Vec3;
  return multiply3x3(LMS_TO_XYZ, lms);
}

function oklchToOklab(l: number, c: number, h: number): Vec3 {
  const rad = (h * Math.PI) / 180;
  return [l, c * Math.cos(rad), c * Math.sin(rad)];
}

// Convert numeric components in a given DTCG color space to sRGB
// (gamma-encoded, not yet gamut-clamped). Returns undefined for spaces this
// module doesn't know how to convert (e.g. xyz-d65/xyz-d50).
function componentsToSrgb(colorSpace: string, c: Vec3): Vec3 | undefined {
  switch (colorSpace) {
    case "srgb":
      return c;
    case "srgb-linear":
      return c.map(linearToSrgb) as unknown as Vec3;
    case "display-p3":
      return xyzD65ToSrgb(multiply3x3(LIN_P3_TO_XYZ, c.map(srgbToLinear) as unknown as Vec3));
    case "a98-rgb":
      return xyzD65ToSrgb(multiply3x3(LIN_A98RGB_TO_XYZ, c.map(a98ToLinear) as unknown as Vec3));
    case "rec2020":
      return xyzD65ToSrgb(multiply3x3(LIN_2020_TO_XYZ, c.map(rec2020ToLinear) as unknown as Vec3));
    case "prophoto-rgb": {
      const xyzD50 = multiply3x3(LIN_PROPHOTO_TO_XYZ_D50, c.map(prophotoToLinear) as unknown as Vec3);
      return xyzD65ToSrgb(multiply3x3(D50_TO_D65, xyzD50));
    }
    case "hsl":
      return hslToSrgb(c[0], c[1], c[2]);
    case "hwb":
      return hwbToSrgb(c[0], c[1], c[2]);
    case "lab":
      return xyzD65ToSrgb(multiply3x3(D50_TO_D65, labToXyzD50(c[0], c[1], c[2])));
    case "lch": {
      const [l, a, b] = lchToLab(c[0], c[1], c[2]);
      return xyzD65ToSrgb(multiply3x3(D50_TO_D65, labToXyzD50(l, a, b)));
    }
    case "oklab":
      return xyzD65ToSrgb(oklabToXyzD65(c[0], c[1], c[2]));
    case "oklch": {
      const [l, a, b] = oklchToOklab(c[0], c[1], c[2]);
      return xyzD65ToSrgb(oklabToXyzD65(l, a, b));
    }
    default:
      return undefined;
  }
}

function hexToSrgb(hex: string): Vec3 | undefined {
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!match || match[1] === undefined) return undefined;
  const n = parseInt(match[1], 16);
  return [((n >> 16) & 0xff) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255];
}

/** DTCG color object → LSP Color (0-1 RGBA floats), or undefined if unconvertible. */
export function dtcgColorToLspColor(value: unknown): Color | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const v = value as Record<string, unknown>;

  const alpha = typeof v.alpha === "number" && v.alpha >= 0 && v.alpha <= 1 ? v.alpha : 1;

  let rgb: Vec3 | undefined;
  if (
    typeof v.colorSpace === "string" &&
    Array.isArray(v.components) &&
    v.components.length === 3 &&
    v.components.every((comp) => typeof comp === "number")
  ) {
    rgb = componentsToSrgb(v.colorSpace, v.components as unknown as Vec3);
  }
  if (!rgb && typeof v.hex === "string") {
    rgb = hexToSrgb(v.hex);
  }
  if (!rgb) return undefined;

  return {
    red: clamp01(rgb[0]),
    green: clamp01(rgb[1]),
    blue: clamp01(rgb[2]),
    alpha,
  };
}

/** LSP Color → "#rrggbb" or "#rrggbbaa" (aa only when alpha < 1). */
export function lspColorToHex(color: Color): string {
  const toHex = (n: number): string =>
    Math.round(clamp01(n) * 255)
      .toString(16)
      .padStart(2, "0");
  const base = `#${toHex(color.red)}${toHex(color.green)}${toHex(color.blue)}`;
  return color.alpha < 1 ? `${base}${toHex(color.alpha)}` : base;
}
