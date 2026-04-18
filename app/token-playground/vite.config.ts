import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import solidPlugin from "vite-plugin-solid";
import UnocssPlugin from "@unocss/vite";

const rootSchemaPath = resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../schema.json",
);

// Serves the repo-root schema.json at /schema.json during dev and emits it as
// a static asset for production. Keeps the playground's $schema reference
// pointing at a file that is actually reachable.
const rootSchemaPlugin = (): Plugin => ({
  name: "serve-root-schema",
  configureServer(server) {
    server.middlewares.use("/schema.json", (_req, res, next) => {
      try {
        const content = readFileSync(rootSchemaPath, "utf-8");
        res.setHeader("Content-Type", "application/json");
        res.end(content);
      } catch {
        next();
      }
    });
  },
  generateBundle() {
    this.emitFile({
      type: "asset",
      fileName: "schema.json",
      source: readFileSync(rootSchemaPath, "utf-8"),
    });
  },
});

export default defineConfig({
  plugins: [solidPlugin(), UnocssPlugin(), rootSchemaPlugin()],
  server: {
    port: 1234,
  },
  build: {
    target: "esnext",
  },
});
