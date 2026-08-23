import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
      // Ver tests/ayudas/server-only.ts.
      "server-only": path.resolve(
        import.meta.dirname,
        "tests/ayudas/server-only.ts",
      ),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
