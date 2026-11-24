import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { embeddedTheme, themeDirectory } from "./theme.ts";

const iconFiles = new Map<string, string>();
if (!embeddedTheme) {
  for (const path of new Bun.Glob("**/*.svg").scanSync({ cwd: `${themeDirectory}/icons`, absolute: true })) {
    iconFiles.set(basename(path, ".svg"), path);
  }
}
const rendered = new Map<string, string>();

export function readIconSources() {
  return Object.fromEntries([...iconFiles].map(([name, path]) => [name, readFileSync(path, "utf8")]));
}

export function isIcon(name: string) {
  return embeddedTheme ? name in embeddedTheme.icons : iconFiles.has(name);
}

export function icon(name: string) {
  let svg = rendered.get(name);
  if (svg) {
    return svg;
  }
  const path = iconFiles.get(name);
  const source = embeddedTheme ? embeddedTheme.icons[name] : path && readFileSync(path, "utf8");
  if (!source) {
    throw new Error(`Lucide icon "${name}" not found in theme/icons. Run: mise run icons`);
  }
  svg = source
    .replace(/\s+/g, " ")
    .replace(/>\s+</g, "><")
    .trim()
    .replace("<svg", `<svg class="icon icon-${name}" aria-hidden="true" focusable="false"`);
  rendered.set(name, svg);
  return svg;
}
