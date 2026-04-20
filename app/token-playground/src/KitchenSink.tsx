import { For, Show, type Component } from "solid-js";
import {
  bezierToCss,
  colorToCss,
  dimensionToCss,
  durationToCss,
  fontFamilyToCss,
  fontSizeToCss,
  fontWeightToCss,
  shadowToCss,
  type FlatToken,
  type TokenType,
} from "./tokens";

const TYPE_ORDER: TokenType[] = [
  "color",
  "dimension",
  "fontFamily",
  "fontWeight",
  "fontSize",
  "shadow",
  "duration",
  "cubicBezier",
  "stroke",
  "strokeStyle",
  "number",
];

export const KitchenSink: Component<{ tokens: FlatToken[] }> = (props) => {
  const grouped = () => {
    const map = new Map<TokenType, FlatToken[]>();
    for (const t of props.tokens) {
      if (!map.has(t.$type)) map.set(t.$type, []);
      map.get(t.$type)!.push(t);
    }
    return TYPE_ORDER.filter((t) => map.has(t)).map(
      (type) => [type, map.get(type)!] as const,
    );
  };

  return (
    <div class="size-full overflow-auto p-4">
      <Show
        when={props.tokens.length > 0}
        fallback={
          <div class="text-sm text-gray-500 dark:text-gray-400">
            No tokens parsed. Check JSON for syntax errors.
          </div>
        }
      >
        <div class="space-y-6">
          <For each={grouped()}>
            {([type, tokens]) => (
              <section>
                <h3 class="mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wide dark:text-gray-400">
                  {type}
                </h3>
                <div class="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
                  <For each={tokens}>
                    {(token) => <Swatch token={token} />}
                  </For>
                </div>
              </section>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};

const Swatch: Component<{ token: FlatToken }> = (props) => {
  return (
    <div class="rounded-md border border-gray-200 bg-white p-2 text-xs dark:border-gray-700 dark:bg-gray-800">
      <div class="mb-2 flex min-h-16 items-center justify-center">
        <Preview token={props.token} />
      </div>
      <div
        class="truncate font-mono text-gray-900 dark:text-gray-100"
        title={props.token.path}
      >
        {props.token.path}
      </div>
      <div
        class="truncate text-gray-500 dark:text-gray-400"
        title={formatValue(props.token)}
      >
        {formatValue(props.token)}
      </div>
    </div>
  );
};

const Preview: Component<{ token: FlatToken }> = (props) => {
  switch (props.token.$type) {
    case "color": {
      const css = colorToCss(props.token.$value);
      return (
        <div
          class="h-12 w-12 rounded-full border border-gray-200 dark:border-gray-700"
          style={{ "background-color": css ?? "transparent" }}
        />
      );
    }
    case "dimension": {
      const css = dimensionToCss(props.token.$value);
      return (
        <div
          class="h-2 rounded-full bg-indigo-500"
          style={{ width: css ?? "0" }}
        />
      );
    }
    case "fontFamily": {
      const css = fontFamilyToCss(props.token.$value);
      return (
        <div class="text-lg" style={{ "font-family": css ?? "inherit" }}>
          Abc 123
        </div>
      );
    }
    case "fontWeight": {
      const weight = fontWeightToCss(props.token.$value);
      return (
        <div class="text-lg" style={{ "font-weight": weight ?? 400 }}>
          Abc 123
        </div>
      );
    }
    case "fontSize": {
      const css = fontSizeToCss(props.token.$value);
      return (
        <div style={{ "font-size": css ?? "inherit" }}>Aa</div>
      );
    }
    case "shadow": {
      const css = shadowToCss(props.token.$value);
      return (
        <div
          class="h-10 w-10 rounded bg-white"
          style={{ "box-shadow": css ?? "none" }}
        />
      );
    }
    case "duration": {
      const css = durationToCss(props.token.$value);
      return (
        <div class="relative h-2 w-full overflow-hidden rounded bg-gray-100 dark:bg-gray-700">
          <div
            class="absolute inset-y-0 left-0 w-4 rounded bg-emerald-500"
            style={{
              animation: `slide ${css ?? "1s"} linear infinite`,
            }}
          />
        </div>
      );
    }
    case "cubicBezier": {
      const css = bezierToCss(props.token.$value);
      return (
        <div class="relative h-2 w-full overflow-hidden rounded bg-gray-100 dark:bg-gray-700">
          <div
            class="absolute inset-y-0 left-0 h-2 w-2 rounded-full bg-rose-500"
            style={{
              animation: `slide 1.2s ${css ?? "linear"} infinite`,
            }}
          />
        </div>
      );
    }
    case "stroke": {
      const style = String(props.token.$value ?? "solid");
      return (
        <div
          class="h-10 w-10 rounded"
          style={{ border: `3px ${style} #6366f1` }}
        />
      );
    }
    case "strokeStyle": {
      return <code class="text-xs">{formatValue(props.token)}</code>;
    }
    case "number": {
      return (
        <div class="font-mono text-lg">{String(props.token.$value)}</div>
      );
    }
    default:
      return <code class="text-xs">{formatValue(props.token)}</code>;
  }
};

function formatValue(t: FlatToken): string {
  switch (t.$type) {
    case "color":
      return colorToCss(t.$value) ?? JSON.stringify(t.$value);
    case "dimension":
      return dimensionToCss(t.$value) ?? JSON.stringify(t.$value);
    case "duration":
      return durationToCss(t.$value) ?? JSON.stringify(t.$value);
    case "cubicBezier":
      return bezierToCss(t.$value) ?? JSON.stringify(t.$value);
    case "fontFamily":
      return fontFamilyToCss(t.$value) ?? JSON.stringify(t.$value);
    case "fontWeight":
      return String(fontWeightToCss(t.$value) ?? t.$value);
    case "fontSize":
      return fontSizeToCss(t.$value) ?? String(t.$value);
    case "shadow":
      return shadowToCss(t.$value) ?? JSON.stringify(t.$value);
    default:
      return typeof t.$value === "object"
        ? JSON.stringify(t.$value)
        : String(t.$value);
  }
}

export default KitchenSink;
