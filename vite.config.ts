import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  resolve: {
    alias: {
      "@/assets/olympus-storm/reference.webp": fileURLToPath(
        new URL("./src/assets/olympus-storm/authorial-cabinet.svg", import.meta.url),
      ),
    },
  },

  tanstackStart: {
    server: { entry: "server" },
  },

  nitro: {
    preset: "node-server",
  },
});
