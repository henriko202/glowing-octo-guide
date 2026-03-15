import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "convex/server": path.resolve(__dirname, "../convex-mocks/_test/__mocks__/convex_server_generics.ts"),
    },
  },
});
