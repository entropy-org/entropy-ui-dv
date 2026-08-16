import { gzipSync } from "node:zlib"
import { resolve } from "node:path"
import { build } from "vite"

const entries = {
  core: { budget: 120_000, forbidden: ["/calendar/", "/kanban/", "/timeline/"] },
  list: { budget: 100_000, forbidden: ["/calendar/", "/kanban/", "/timeline/"] },
  kanban: { budget: 160_000, forbidden: ["/calendar/", "/timeline/"] },
  calendar: { budget: 160_000, forbidden: ["@dnd-kit", "/kanban/", "/timeline/"] },
  timeline: { budget: 160_000, forbidden: ["@dnd-kit", "/calendar/", "/kanban/"] },
  adapters: { budget: 300_000, forbidden: [] },
}

let failed = false
for (const [name, policy] of Object.entries(entries)) {
  const result = await build({
    configFile: false,
    logLevel: "silent",
    build: {
      write: false,
      minify: "esbuild",
      lib: {
        entry: resolve(`scripts/bundle-entries/${name}.js`),
        formats: ["es"],
        fileName: () => `${name}.js`,
      },
      rolldownOptions: {
        external: (id) => id === "react" || id === "react-dom" || id.startsWith("react/"),
      },
    },
  })
  const outputs = Array.isArray(result) ? result.flatMap((entry) => entry.output) : result.output
  const chunks = outputs.filter((output) => output.type === "chunk")
  const code = chunks.map((chunk) => chunk.code).join("\n")
  const modules = new Set(chunks.flatMap((chunk) => Object.keys(chunk.modules)))
  const gzipBytes = gzipSync(code).byteLength
  const violations = policy.forbidden.filter((term) =>
    [...modules].some((moduleId) => moduleId.replaceAll("\\", "/").includes(term))
  )
  if (gzipBytes > policy.budget || violations.length > 0) failed = true
  process.stdout.write(
    `${name.padEnd(9)} ${String(code.length).padStart(8)} bytes minified, ${String(gzipBytes).padStart(7)} gzip, ${String(modules.size).padStart(4)} modules${violations.length ? `; forbidden: ${violations.join(", ")}` : ""}\n`
  )
}

if (failed) throw new Error("A bundle budget or subpath isolation policy failed.")
