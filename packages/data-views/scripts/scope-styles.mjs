import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import prefixSelector from "postcss-prefix-selector";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const stylesheetPath = path.join(packageRoot, "dist", "styles.css");
const scope = ":where(.edv-root,[data-edv-root])";

function isAlreadyScoped(selector) {
  return (
    selector.includes(".edv-root") ||
    selector.includes("[data-edv-root]") ||
    selector.includes("[data-edv-theme")
  );
}

function scopeSelector(selector) {
  if (isAlreadyScoped(selector)) return selector;
  if ([":root", ":host", "html", "body"].includes(selector)) return scope;
  if (selector === "*") return `${scope},${scope} *`;

  const descendant = `${scope} ${selector}`;
  if (/^[.:[#]/.test(selector)) return `${scope}${selector},${descendant}`;
  return descendant;
}

function isInsideKeyframes(rule) {
  let parent = rule.parent;
  while (parent) {
    if (parent.type === "atrule" && parent.name.endsWith("keyframes")) {
      return true;
    }
    parent = parent.parent;
  }
  return false;
}

const source = await readFile(stylesheetPath, "utf8");
const result = await postcss([
  prefixSelector({
    prefix: scope,
    transform: (_prefix, selector) => scopeSelector(selector),
  }),
]).process(source, { from: stylesheetPath, to: stylesheetPath });

const leakedSelectors = [];
result.root.walkRules((rule) => {
  if (isInsideKeyframes(rule)) return;
  for (const selector of rule.selectors ?? []) {
    if (!isAlreadyScoped(selector)) leakedSelectors.push(selector);
  }
});

if (leakedSelectors.length > 0) {
  throw new Error(
    `Generated stylesheet contains unscoped selectors:\n${[
      ...new Set(leakedSelectors),
    ].join("\n")}`,
  );
}

await writeFile(stylesheetPath, result.css);
