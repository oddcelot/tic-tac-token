import { colorToCss, type FlatToken, type TokenMode } from "../preview/tokens.ts";
import { cardStyles, defineElement, esc } from "./shared.ts";

export const tokenColorTag = "token-color";

export class TokenColor extends HTMLElement {
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
    const cards = this.#tokens
      .map((t) => {
        const css = colorToCss(t.$value) ?? "transparent";
        const value = css === "transparent" ? JSON.stringify(t.$value) : css;
        return `
          <div class="card">
            <div style="height:56px;border-radius:6px;background:${css};margin-bottom:8px"></div>
            <div class="name" title="${esc(t.path)}">${esc(t.path)}</div>
            <div class="label" title="${esc(value)}">${esc(value)}</div>
          </div>
        `;
      })
      .join("");
    this.shadowRoot!.innerHTML = `
      <style>
        ${cardStyles()}
      </style>
      ${this.#tokens.length === 0 ? `<p style="font-size:13px;color:var(--sb-token-muted,#6a7076)">No color tokens for the “${this.#mode}” mode.</p>` : `<div class="grid">${cards}</div>`}
    `;
  }
}

defineElement(tokenColorTag, TokenColor);