import type { Preview } from "@storybook/web-components-vite";

const preview: Preview = {
  tags: ["autodocs"],
  parameters: {
    controls: { expanded: true },
  },
};

export default preview;