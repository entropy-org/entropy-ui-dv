import { existsSync, readdirSync, statSync } from "node:fs"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import packageJson from "../package.json" with { type: "json" }

const failures = []
for (const [subpath, target] of Object.entries(packageJson.exports)) {
  const targets = typeof target === "string" ? [target] : Object.values(target)
  for (const file of targets) {
    if (!existsSync(resolve(file))) failures.push(`${subpath} -> ${file} does not exist`)
  }
}

function visit(directory) {
  for (const name of readdirSync(directory)) {
    const path = resolve(directory, name)
    if (statSync(path).isDirectory()) visit(path)
    else if (/\.(test|stories|compile-test)\./.test(name)) failures.push(`Unexpected build file: ${path}`)
  }
}
visit(resolve("dist"))

const cssBytes = statSync(resolve("dist/styles.css")).size
if (cssBytes > 130_000) failures.push(`Compiled CSS is ${cssBytes} bytes (budget 130000).`)

await import(pathToFileURL(resolve("dist/server.js")))
await import(pathToFileURL(resolve("dist/index.js")))

if (failures.length > 0) throw new Error(failures.join("\n"))
process.stdout.write(`Verified ${Object.keys(packageJson.exports).length} exports and ${cssBytes} bytes of compiled CSS.\n`)
