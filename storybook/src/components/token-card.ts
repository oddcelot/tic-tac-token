import { tokensToCssVars } from "@oddsquad/tic-tac-token/css";
import type { FlatToken, TokenMode } from "../preview/tokens.ts";
import { defineElement } from "./shared.ts";

export const tokenCardTag = "token-card";

// A sample card built from the resolved design tokens. Instead of hardcoding
// any value it derives a CSS custom-property sheet via core `tokensToCssVars`
// and then consumes only the stable role vars (`--color-primary`, …) through
// the bundle's `for(...)`. The card therefore follows whichever theme + color
// scheme is active without any markup change.
const ROLES = [
  "color.primary",
  "color.accent",
  "spacing.card",
  "spacing.radius",
  "font.family.sans",
  "font.weight.bold",
] as const;

export class TokenCard extends HTMLElement {
  #tokens: FlatToken[] = [];
  #mode: TokenMode = "light";

  get tokens(): FlatToken[] {
    return this.#tokens;
  }

  set tokens(value: FlatToken[]) {
    this.#tokens = value;
    this.#render();
  }

  get mode(): TokenMode {
    return this.#mode;
  }

  set mode(value: TokenMode) {
    this.#mode = value;
    this.#render();
  }

  connectedCallback(): void {
    this.#render();
  }

  #render(): void {
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    const bundle = tokensToCssVars(this.#tokens);
    const vars = bundle.for(...ROLES);

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
        .card__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
        }
        .card__title {
          margin: 0;
          font-size: 18px;
          font-weight: ${weight};
          line-height: 1.2;
        }
        .card__badge {
          background: ${primary};
          color: var(--sb-token-primary-ink, #ffffff);
          font-size: 11px;
          font-weight: ${weight};
          padding: 2px 8px;
          border-radius: 999px;
        }
        .card__body {
          margin: 0;
          font-size: 14px;
          line-height: 1.5;
          opacity: 0.85;
        }
        .card__foot {
          margin-top: 12px;
          padding-top: 10px;
          border-top: 1px solid ${accent}33;
          color: ${primary};
          font-size: 12px;
          font-weight: ${weight};
        }
      </style>
      <div class="card">
        <div class="card__header">
          <h3 class="card__title">Design tokens</h3>
          <span class="card__badge">${css ? "themed" : "—"}</span>
        </div>
        <p class="card__body">
          This card's color, type and spacing come straight from the active
          theme's resolved token document as CSS custom properties.
        </p>
        <div class="card__foot">● ${this.#mode} mode</div>
      </div>
    `;
  }
}

defineElement(tokenCardTag, TokenCard);