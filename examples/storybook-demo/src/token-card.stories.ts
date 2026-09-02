// The story is nothing but the element. Every token concern — resolving the
// document, picking the theme and colour scheme, writing the custom properties
// — belongs to the addon's decorator, and the component reads the result
// through plain `var()`.
import { tokenCardTag } from "./token-card";

export default {
  title: "Example/Card",
  component: tokenCardTag,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        story:
          "A sample component authored in the demo itself (src/token-card.ts). " +
          "It contains no token code at all: it styles itself from role variables " +
          "(--color-primary, --spacing-card, …) that the addon binds on :root from " +
          "the resolver document. Switch Theme or Color scheme in the toolbar and " +
          "the card follows without re-rendering.",
      },
    },
  },
  render: () => document.createElement(tokenCardTag),
};

export const Default = {};
