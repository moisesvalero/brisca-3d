import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  // Workspace packages ship TypeScript sources, so bundle them into the
  // production server instead of leaving bare TS imports at runtime.
  noExternal: ["@brisca/session", "@brisca/core"],
});
