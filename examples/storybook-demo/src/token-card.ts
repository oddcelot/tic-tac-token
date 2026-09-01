// A sample component built the way the demo's own app would: it consumes the
// core @oddsquad/tic-tac-token API directly (resolveTokens + tokensToCssVars)
// with no Storybook-addon involvement for the token logic. It derives CSS
// custom properties from the current theme's resolved token document and
// styles itself only from stable role vars, so the same markup follows the
// active theme × color scheme without any code changes.
import { resolveTokens } from "@oddsquad/tic-tac-token/resolver";
import { tokensToCssVars } from "@oddsquad/tic-tac-token/css";
import type { FlatToken } from "@oddsquad/tic-tac-token/resolver";

export const tokenCardTag = "token-card";

const ROLES = [
  "color.primary",
  "color.accent",
  "spacing.card",
  "spacing.radius",
  "font.family.sans",
  "font.weight.bold",
] as const;

export class TokenCard extends HTMLElement {
  #doc: string = "";
  #mode: "light" | "dark" = "light";

  get document(): string {
    return this.#doc;
  }

  set document(value: string) {
    this.#doc = value;
    this.#render();
  }

  get mode(): "light" | "dark" {
    return this.#mode;
  }

  set mode(value: "light" | "dark") {
    this.#mode = value;
    this.#render();
  }

  connectedCallback(): void {
    this.#render();
  }

  #render(): void {
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    const vars = this.#cssVars();
    const css = Object.entries(vars)
      .map(([k, v]) => `${k}: ${v};`)
      .join(" ");

    const primary = vars["--color-primary"] ?? "#1a1d21";
    const accent = vars["--color-accent"] ?? primary;
    const padding = vars["--spacing-card"] ?? "16px";
    const radius = vars["--spacing-radius"] ?? "12px";
    const family = vars["--font-family-sans"] ?? "sans-serif";
    const weight = vars["--font-weight-bold"] ?? "700";

    this.shadowRoot!.innerHTML = `
      <style>
        :host { display: block; }
        .card {
          box-sizing: border-box;
          background: var(--sb-token-surface, #ffffff);
          border: 2px solid ${accent};
          border-radius: ${radius};
          padding: ${padding};
          font-family: ${family};
          color: var(--sb-token-ink, #1a1d21);
          max-width: 320px;
        }
        .card__header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
        .card__title { margin: 0; font-size: 18px; font-weight: ${weight}; line-height: 1.2; }
        .card__badge {
          background: ${primary}; color: var(--sb-token-primary-ink, #ffffff);
          font-size: 11px; font-weight: ${weight}; padding: 2px 8px; border-radius: 999px;
        }
        .card__body { margin: 0; font-size: 14px; line-height: 1.5; opacity: 0.85; }
        .card__foot { margin-top: 12px; padding-top: 10px; border-top: 1px solid ${accent}33; color: ${primary}; font-size: 12px; font-weight: ${weight}; }
      </style>
      <div class="card">
        <div class="card__header">
          <h3 class="card__title">Design tokens</h3>
          <span class="card__badge">${css ? "themed" : "—"}</span>
        </div>
        <p class="card__body">This card's color, type and spacing come straight from the active theme's token document as CSS custom properties.</p>
        <div class="card__foot">● ${this.#mode} mode</div>
      </div>
    `;
  }

  #cssVars(): Record<string, string> {
    if (!this.#doc) return {};
    let parsed: unknown;
    try {
      parsed = JSON.parse(this.#doc);
    } catch {
      return {};
    }
    const { tokens } = resolveTokens(parsed);
    const modeTokens = this.#filterMode(tokens, this.#mode);
    return tokensToCssVars(modeTokens).for(...ROLES);
  }

  #filterMode(tokens: FlatToken[], mode: "light" | "dark"): FlatToken[] {
    if (mode === "light") return tokens.filter((t) => !t.mode);
    const modePaths = new Set(
      tokens.filter((t) => t.mode === mode).map((t) => t.path.replace(/@\w+$/, "")),
    );
    return tokens.filter(
      (t) => t.mode === mode || (!t.mode && !modePaths.has(t.path)),
    );
  }
}

if (!customElements.get(tokenCardTag)) {
  customElements.define(tokenCardTag, TokenCard);
}