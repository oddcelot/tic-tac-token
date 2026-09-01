import { type FlatToken, dimensionToCss } from "../preview/tokens.ts";
import { cardStyles, defineElement, esc } from "./shared.ts";

export const tokenDimensionTag = "token-dimension";

export class TokenDimension extends HTMLElement {
  #tokens: FlatToken[] = [];
  #sample = "Design tokens are the real assets of a system.";

  get tokens(): FlatToken[] {
    return this.#tokens;
  }

  set tokens(value: FlatToken[]) {
    this.#tokens = value;
    this.#render();
  }

  get sample(): string {
    return this.#sample;
  }

  set sample(value: string) {
    this.#sample = value;
    this.#render();
  }

  connectedCallback(): void {
    this.#render();
  }

  #render(): void {
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    if (this.#tokens.length === 0) {
      this.shadowRoot!.innerHTML = `<p style="font-size:13px;color:var(--sb-token-muted,#6a7076)">No dimension tokens.</p>`;
      return;
    }
    const sorted = [...this.#tokens].sort((a, b) => {
      const av = typeof (a.$value as { value?: unknown } | null)?.value === "number"
        ? (a.$value as { value: number }).value
        : 0;
      const bv = typeof (b.$value as { value?: unknown } | null)?.value === "number"
        ? (b.$value as { value: number }).value
        : 0;
      return av - bv;
    });
    const rows = sorted
      .map((t) => {
        const css = dimensionToCss(t.$value);
        if (!css) return "";
        return `
          <div class="row">
            <div class="row-label">${esc(t.path)}</div>
            <div class="row-body">
              <div style="font-family:var(--sb-token-font, inherit);font-size:${css};font-weight:600;line-height:1.4">
                ${esc(this.#sample)}
              </div>
              <div class="label">${css}</div>
            </div>
          </div>
        `;
      })
      .join("");
    this.shadowRoot!.innerHTML = `<style>${cardStyles()}</style>${rows}`;
  }
}

defineElement(tokenDimensionTag, TokenDimension);