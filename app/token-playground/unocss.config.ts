import { defineConfig } from "@unocss/vite";
import { presetMini } from "@unocss/preset-mini";

export default defineConfig({
  // Class-based dark mode: a "dark" class on <html> activates `dark:` variants,
  // so we can drive the theme from a UI toggle rather than OS preference.
  presets: [presetMini({ dark: "class" })],
});
