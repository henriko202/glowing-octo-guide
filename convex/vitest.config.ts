import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "convex/server": path.resolve(__dirname, "test/__mocks__/convex-server.ts"),
    },
  },
});
