import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // The showcase elements register at import time and render via
    // document.createElement, so a DOM environment is required.
    environment: "happy-dom",
  },
});