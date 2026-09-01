// A sample component built the way the demo's own app would: it knows nothing
// about design tokens as *data*. It styles itself purely from role custom
// properties — `--color-surface`, `--spacing-card`, `--font-family-sans` — and
// the same markup follows the active theme × colour scheme with no code path
// of its own.
//
// Custom properties set on `:root` inherit through the shadow boundary, which
// is why a shadow-DOM component needs no wiring at all. Compare the previous
// version of this file, which parsed the document, resolved it, filtered a
// mode and pushed inline vars onto the host — all of that is now the resolver
// document's job.
export const tokenCardTag = "token-card";

export class TokenCard extends HTMLElement {
  connectedCallback(): void {
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this.shadowRoot!.innerHTML = `
      <style>
        :host { display: block; }
        .card {
          box-sizing: border-box;
          background: var(--color-surface, #ffffff);
          border: 2px solid var(--color-accent, #1a1d21);
          border-radius: var(--spacing-radius, 12px);
          padding: var(--spacing-card, 16px);
          font-family: var(--font-family-sans, sans-serif);
          color: var(--color-ink, #1a1d21);
          max-width: 320px;
        }
        .card__header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
        .card__title { margin: 0; font-size: 18px; font-weight: var(--font-weight-bold, 700); line-height: 1.2; }
        .card__badge {
          background: var(--color-primary, #1a1d21);
          color: var(--color-surface, #ffffff);
          font-size: 11px;
          font-weight: var(--font-weight-bold, 700);
          padding: 2px 8px;
          border-radius: 999px;
        }
        .card__body { margin: 0; font-size: 14px; line-height: 1.5; opacity: 0.85; }
        .card__foot {
          margin-top: 12px;
          padding-top: 10px;
          border-top: 1px solid color-mix(in srgb, var(--color-accent, #1a1d21) 20%, transparent);
          color: var(--color-primary, #1a1d21);
          font-size: 12px;
          font-weight: var(--font-weight-bold, 700);
        }
      </style>
      <div class="card">
        <div class="card__header">
          <h3 class="card__title">Design tokens</h3>
          <span class="card__badge">themed</span>
        </div>
        <p class="card__body">
          This card's colour, type and spacing are plain <code>var()</code> references.
          Switching Theme or Color scheme in the toolbar rebinds them; the component
          never re-renders.
        </p>
        <div class="card__foot">● styled entirely from role variables</div>
      </div>
    `;
  }
}

if (!customElements.get(tokenCardTag)) {
  customElements.define(tokenCardTag, TokenCard);
}
