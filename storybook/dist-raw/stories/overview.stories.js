import { resolveForContext } from "../resolve.js";
import { parseTokens } from "../tokens.js";
import { tokenGalleryTag } from "../../components/index.js";
import raw from "../tokens.json?raw";

export default {
  title: "Tokens/Overview",
  component: tokenGalleryTag,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        story:
          "Every supported token type in one place, grouped into sections by the tokens-gallery element. Use the toolbar to switch between the contexts the project's resolver document declares.",
      },
    },
  },
  render: (args, context) => {
    // The project's own tokens when it supplied any; the addon's bundled
    // document only as a fallback, so a real resolver document is never
    // shadowed by the demo one.
    const resolved = resolveForContext(context).tokens;
    const tokens = resolved.length > 0 ? resolved : parseTokens(raw, "light");
    const el = document.createElement(tokenGalleryTag);
    Object.assign(el, { tokens });
    return el;
  },
};

export const Default = {};
