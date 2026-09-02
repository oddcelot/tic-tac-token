// Putting the active combination's custom properties on the preview document.
//
// Written to `:root` rather than a decorator wrapper, for three reasons: it is
// how a real application consumes tokens, custom properties inherit through
// the shadow boundary every showcase element uses, and it also reaches `<body>`
// chrome and docs pages that no story wrapper contains.
//
// The active context of each modifier is mirrored onto a `data-*` attribute as
// well, so consumer CSS can scope to it exactly as it would in production.
import { resolverModifiers } from "@oddsquad/tic-tac-token/resolver-module";
import {
  attributeFor,
  colorSchemeModifier,
  initialContextFor,
} from "./resolverConfig.ts";
import { resolveForContext, type TokenResolution } from "./resolve.ts";
import { tokenSourceFromParameters } from "./tokens.ts";
import type { TokenRenderContext } from "./tokens.ts";

/** Marks the addon's own style element so re-applying replaces rather than appends. */
export const STYLE_MARKER = "data-tic-tac-token";

export type ApplyOptions = {
  /** Selector the properties are written under. `false` skips injection. */
  cssSelector?: string | false;
  /** Mirror each modifier's active context onto a `data-*` attribute. */
  attributes?: boolean;
};

function styleElement(doc: Document): HTMLStyleElement {
  const existing = doc.head.querySelector<HTMLStyleElement>(
    `style[${STYLE_MARKER}="vars"]`,
  );
  if (existing) return existing;
  const created = doc.createElement("style");
  created.setAttribute(STYLE_MARKER, "vars");
  doc.head.appendChild(created);
  return created;
}

/**
 * Resolve the active combination and apply it to the preview document.
 *
 * Idempotent: applying the same globals twice leaves the DOM untouched, so a
 * story re-render costs nothing and never triggers a style recalculation.
 */
export function applyTokenTheme(
  context: TokenRenderContext,
  options: ApplyOptions = {},
): TokenResolution {
  const resolution = resolveForContext(context);

  if (typeof document === "undefined") return resolution;

  const selector = options.cssSelector ?? ":root";
  if (selector !== false) {
    const style = styleElement(document);
    const css = resolution.css
      ? `${selector} {\n${resolution.css
          .split("\n")
          .map((line) => `  ${line}`)
          .join("\n")}\n}`
      : "";
    if (style.textContent !== css) style.textContent = css;
  }

  if (options.attributes === false) return resolution;

  const source = tokenSourceFromParameters(context);
  if (source?.kind !== "resolver") return resolution;

  const root = document.documentElement;
  const scheme = colorSchemeModifier(source.document);

  for (const modifier of resolverModifiers(source.document)) {
    const active = resolution.inputs[modifier.name] ?? initialContextFor(modifier);
    if (active === undefined) continue;

    const attribute = attributeFor(modifier);
    if (attribute && root.getAttribute(attribute) !== active) {
      root.setAttribute(attribute, active);
    }

    // Let the browser match native UI — scrollbars, form controls, the default
    // canvas — to the active scheme. Only for a context CSS actually
    // understands; an `appearance=sepia` context has no `color-scheme` value.
    if (scheme && modifier.name === scheme.name && (active === "light" || active === "dark")) {
      root.style.colorScheme = active;
      document.body.style.colorScheme = active;
    }
  }

  return resolution;
}
