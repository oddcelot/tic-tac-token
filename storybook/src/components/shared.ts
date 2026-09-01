// Base helpers for the showcase custom elements. All elements render purely
// from assigned properties; nothing is framework-specific.
export type { FlatToken, TokenMode, TokenType } from "../preview/tokens.ts";

/** Register a custom element, ignoring re-definition (HMR / duplicate loads). */
export function defineElement(
  tagName: string,
  ctor: CustomElementConstructor,
): CustomElementConstructor {
  if (!customElements.get(tagName)) customElements.define(tagName, ctor);
  return ctor;
}

/** Create an element and assign initial properties in one expression. */
export function ce<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  props?: Record<string, unknown>,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tagName);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      (node as Record<string, unknown>)[k] = v;
    }
  }
  return node;
}

const escapeRegExp = /[&<>"']/g;
const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escape a string before injecting it into innerHTML markup. */
export function esc(value: string): string {
  return value.replace(escapeRegExp, (ch) => ESCAPES[ch] ?? ch);
}

export function cardStyles(): string {
  return `
    :host { display: block; color: var(--sb-token-ink, #1a1d21); }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 12px;
    }
    .card {
      box-sizing: border-box;
      border: 1px solid var(--sb-token-line, #d9dde3);
      border-radius: 8px;
      background: var(--sb-token-surface, #ffffff);
      padding: 10px 12px;
      overflow: hidden;
    }
    .name { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; }
    .label {
      font-size: 11px;
      color: var(--sb-token-muted, #6a7076);
      margin-top: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .row {
      display: flex;
      align-items: baseline;
      gap: 12px;
      padding: 8px 0;
      border-bottom: 1px solid var(--sb-token-line, #d9dde3);
    }
    .row:last-child { border-bottom: none; }
    .row-label {
      flex: 0 0 auto;
      max-width: 220px;
      font-size: 11px;
      color: var(--sb-token-muted, #6a7076);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .row-body { flex: 1; min-width: 0; }
  `;
}