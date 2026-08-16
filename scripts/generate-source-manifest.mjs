import { execFileSync } from "node:child_process"
import { writeFileSync } from "node:fs"
import { resolve } from "node:path"

const sourceRepository = resolve(process.argv[2] ?? "../entropy-ui")
const commit = process.argv[3]
if (!commit) throw new Error("Usage: node generate-source-manifest.mjs <source-repo> <commit>")

const roots = [
  "src/components/calendar",
  "src/components/kanban",
  "src/components/list",
  "src/components/timeline",
  "src/components/ui/badge.tsx",
  "src/components/ui/button.tsx",
  "src/components/ui/checkbox.tsx",
  "src/components/ui/input.tsx",
  "src/components/ui/label.tsx",
  "src/components/ui/popover.tsx",
  "src/components/ui/select.tsx",
  "src/components/ui/separator.tsx",
  "src/components/ui/sheet.tsx",
  "src/components/ui/skeleton.tsx",
  "src/components/ui/switch.tsx",
  "src/components/ui/tooltip.tsx",
  "src/hooks/use-shift-wheel.ts",
  "src/lib/utils.ts",
]

const output = execFileSync(
  "git",
  ["-C", sourceRepository, "ls-tree", "-r", "--long", commit, "--", ...roots],
  { encoding: "utf8" }
)
const files = output
  .trim()
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => {
    const match = line.match(/^\d+ blob ([0-9a-f]+)\s+(\d+)\t(.+)$/)
    if (!match) throw new Error(`Could not parse git ls-tree line: ${line}`)
    return { path: match[3], gitBlob: match[1], bytes: Number(match[2]) }
  })

const manifest = {
  schemaVersion: 1,
  sourceRepository,
  sourceRemote: execFileSync(
    "git",
    ["-C", sourceRepository, "remote", "get-url", "origin"],
    { encoding: "utf8" }
  ).trim(),
  commit,
  generatedAt: new Date().toISOString(),
  roots,
  fileCount: files.length,
  files,
}

writeFileSync(
  resolve("docs/source-manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`
)
process.stdout.write(`Wrote ${files.length} source entries for ${commit}.\n`)
