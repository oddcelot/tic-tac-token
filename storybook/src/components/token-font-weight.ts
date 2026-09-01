import { type FlatToken, fontWeightToCss } from "../preview/tokens.ts";
import { cardStyles, defineElement, esc } from "./shared.ts";

export const tokenFontWeightTag = "token-font-weight";

export class TokenFontWeight extends HTMLElement {
  #tokens: FlatToken[] = [];
  #sample = "The quick brown fox jumps over the lazy dog";

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
      this.shadowRoot!.innerHTML = `<p style="font-size:13px;color:var(--sb-token-muted,#6a7076)">No font-weight tokens.</p>`;
      return;
    }
    const rows = this.#tokens
      .map((t) => {
        const weight = fontWeightToCss(t.$value);
        if (weight === null) return "";
        return `
          <div class="row">
            <div class="row-label">${esc(t.path)}</div>
            <div class="row-body" style="font-family:var(--sb-token-font, inherit);font-weight:${weight};font-size:18px">
              ${esc(this.#sample)}
            </div>
            <div class="label">${weight}</div>
          </div>
        `;
      })
      .join("");
    this.shadowRoot!.innerHTML = `<style>${cardStyles()}</style>${rows}`;
  }
}

defineElement(tokenFontWeightTag, TokenFontWeight);