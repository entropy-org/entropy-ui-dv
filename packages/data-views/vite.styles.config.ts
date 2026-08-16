import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [tailwindcss()],
  build: {
    emptyOutDir: true,
    lib: {
      entry: path.resolve(import.meta.dirname, "src/styles-entry.ts"),
      formats: ["es"],
      fileName: () => "styles-entry.js",
    },
    rollupOptions: {
      output: {
        assetFileNames: (asset) =>
          asset.names?.some((name) => name.endsWith(".css"))
            ? "styles.css"
            : "assets/[name]-[hash][extname]",
      },
    },
  },
})
