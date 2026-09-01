import { type FlatToken, type TokenType } from "../preview/tokens.ts";
import { ce, defineElement } from "./shared.ts";
import { tokenDimensionTag } from "./token-dimension.ts";
import { tokenColorTag } from "./token-color.ts";
import { tokenFontFamilyTag } from "./token-font-family.ts";
import { tokenFontWeightTag } from "./token-font-weight.ts";

export const tokenGalleryTag = "tokens-gallery";

const TYPE_ORDER: TokenType[] = [
  "color",
  "fontFamily",
  "fontWeight",
  "dimension",
];

function tagForType(type: TokenType): string | null {
  switch (type) {
    case "color":
      return tokenColorTag;
    case "fontFamily":
      return tokenFontFamilyTag;
    case "fontWeight":
      return tokenFontWeightTag;
    case "dimension":
      return tokenDimensionTag;
    default:
      return null;
  }
}

export class TokensGallery extends HTMLElement {
  #tokens: FlatToken[] = [];

  get tokens(): FlatToken[] {
    return this.#tokens;
  }

  set tokens(value: FlatToken[]) {
    this.#tokens = value;
    this.#render();
  }

  connectedCallback(): void {
    this.#render();
  }

  #render(): void {
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    const root = this.shadowRoot!;
    root.innerHTML = `
      <style>
        :host { display: block; color: var(--sb-token-ink, #1a1d21); }
        .section-title {
          margin: 0 0 10px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--sb-token-muted, #6a7076);
        }
        section { margin-bottom: 28px; }
        section:last-child { margin-bottom: 0; }
      </style>
    `;
    for (const type of TYPE_ORDER) {
      const grouped = this.#tokens.filter((t) => t.$type === type);
      if (grouped.length === 0) continue;
      const tag = tagForType(type);
      if (!tag) continue;
      const section = document.createElement("section");
      const heading = document.createElement("h3");
      heading.className = "section-title";
      heading.textContent = type;
      section.appendChild(heading);
      section.appendChild(ce(tag as keyof HTMLElementTagNameMap, { tokens: grouped }));
      root.appendChild(section);
    }
    if (root.childNodes.length <= 1) {
      root.appendChild(
        Object.assign(document.createElement("p"), {
          style: "font-size:13px;color:var(--sb-token-muted,#6a7076)",
          textContent: "No supported tokens to display.",
        }),
      );
    }
  }
}

defineElement(tokenGalleryTag, TokensGallery);