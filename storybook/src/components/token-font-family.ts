import { fontFamilyToCss, type FlatToken } from "../preview/tokens.ts";
import { cardStyles, defineElement, esc } from "./shared.ts";

export const tokenFontFamilyTag = "token-font-family";

export class TokenFontFamily extends HTMLElement {
  #tokens: FlatToken[] = [];
  #sample = "The quick brown fox jumps over the lazy dog 0123456789";

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
      this.shadowRoot!.innerHTML = `<p style="font-size:13px;color:var(--sb-token-muted,#6a7076)">No font-family tokens.</p>`;
      return;
    }
    const rows = this.#tokens
      .map((t) => {
        const css = fontFamilyToCss(t.$value);
        if (!css) return "";
        return `
          <div class="row">
            <div class="row-label">${esc(t.path)}</div>
            <div class="row-body">
              <div style="font-family:${css};font-size:18px;line-height:1.4">${esc(this.#sample)}</div>
              <div class="label">${esc(css)}</div>
            </div>
          </div>
        `;
      })
      .join("");
    this.shadowRoot!.innerHTML = `<style>${cardStyles()}</style>${rows}`;
  }
}

defineElement(tokenFontFamilyTag, TokenFontFamily);