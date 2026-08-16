import fs from "node:fs/promises"
import path from "node:path"
import process from "node:process"

const packageRoot = path.resolve(process.cwd(), "packages/data-views")
const sourceRoot = path.join(packageRoot, "src")

async function collectFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const absolute = path.join(directory, entry.name)
      if (entry.isDirectory()) return collectFiles(absolute)
      return /\.[cm]?tsx?$/.test(entry.name) ? [absolute] : []
    })
  )
  return nested.flat()
}

async function sourceTarget(base) {
  const extension = path.extname(base)
  if ([".ts", ".tsx", ".mts", ".cts"].includes(extension)) {
    return { absolute: base.slice(0, -extension.length), suffix: ".js" }
  }

  for (const candidateExtension of [".ts", ".tsx", ".mts", ".cts"]) {
    try {
      const candidate = `${base}${candidateExtension}`
      const stat = await fs.stat(candidate)
      if (stat.isFile()) return { absolute: base, suffix: ".js" }
    } catch {
      // Try the next source form.
    }
  }

  try {
    const stat = await fs.stat(base)
    if (stat.isDirectory()) {
      return { absolute: path.join(base, "index"), suffix: ".js" }
    }
  } catch {
    // The compiler will report genuinely unresolved imports later.
  }

  return null
}

async function rewriteSpecifier(file, specifier) {
  if (specifier.startsWith("@/")) {
    const target = await sourceTarget(path.join(sourceRoot, specifier.slice(2)))
    if (!target) return specifier
    let relative = path.relative(path.dirname(file), target.absolute)
    if (!relative.startsWith(".")) relative = `./${relative}`
    return `${relative.replaceAll(path.sep, "/")}${target.suffix}`
  }

  if (specifier.startsWith(".")) {
    if (/\.[cm]?jsx?$/.test(specifier)) return specifier
    const target = await sourceTarget(path.resolve(path.dirname(file), specifier))
    if (!target) return specifier
    let relative = path.relative(path.dirname(file), target.absolute)
    if (!relative.startsWith(".")) relative = `./${relative}`
    return `${relative.replaceAll(path.sep, "/")}${target.suffix}`
  }

  return specifier
}

async function rewriteFile(file) {
  const original = await fs.readFile(file, "utf8")
  const matcher = /(\bfrom\s+|\bimport\s*\(\s*|\bimport\s+)(["'])([^"']+)\2/g
  let cursor = 0
  let rewritten = ""

  for (const match of original.matchAll(matcher)) {
    const start = match.index ?? 0
    const prefix = match[1]
    const quote = match[2]
    const specifier = match[3]
    const nextSpecifier = await rewriteSpecifier(file, specifier)
    rewritten += original.slice(cursor, start)
    rewritten += `${prefix}${quote}${nextSpecifier}${quote}`
    cursor = start + match[0].length
  }

  rewritten += original.slice(cursor)
  if (rewritten !== original) await fs.writeFile(file, rewritten)
}

const files = await collectFiles(sourceRoot)
for (const file of files) await rewriteFile(file)

process.stdout.write(`Rewrote imports in ${files.length} TypeScript files.\n`)
