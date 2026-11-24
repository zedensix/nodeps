import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import { embeddedTheme, themeDirectory } from "./theme.ts";

export const iconDirectory = `${themeDirectory}/icons`;

let lucideFiles: Map<string, string> | undefined;
let extras: { icons: Record<string, string>; emoji: Record<string, string> } | undefined;
const rendered = new Map<string, string>();

function lucide() {
  if (!lucideFiles) {
    lucideFiles = new Map();
    if (!embeddedTheme && existsSync(iconDirectory)) {
      for (const path of new Bun.Glob("*/*.svg").scanSync({ cwd: iconDirectory })) {
        lucideFiles.set(basename(path, ".svg"), `${iconDirectory}/${path}`);
      }
    }
  }
  return lucideFiles;
}

function extraBundle() {
  if (!extras) {
    const compressed = embeddedTheme
      ? Buffer.from(embeddedTheme.extras, "base64")
      : existsSync(`${iconDirectory}/extra.json.zst`)
        ? readFileSync(`${iconDirectory}/extra.json.zst`)
        : undefined;
    extras = compressed ? JSON.parse(Bun.zstdDecompressSync(compressed).toString()) : { icons: {}, emoji: {} };
  }
  return extras!;
}

export function readIconSources() {
  return Object.fromEntries([...lucide()].map(([name, path]) => [name, readFileSync(path, "utf8")]));
}

export function readExtraBundle() {
  return readFileSync(`${iconDirectory}/extra.json.zst`).toString("base64");
}

function source(name: string) {
  if (embeddedTheme?.icons[name]) {
    return embeddedTheme.icons[name];
  }
  const path = lucide().get(name);
  return path ? readFileSync(path, "utf8") : extraBundle().icons[name];
}

export function normalizeIcon(name: string) {
  const key = name
    .trim()
    .replace(/^lucide[/-]/, "")
    .split("/")
    .join("-");
  return key;
}

export function isIcon(name: string) {
  return (embeddedTheme ? name in embeddedTheme.icons : lucide().has(name)) || name in extraBundle().icons;
}

export function emoji(shortcode: string): string | undefined {
  return extraBundle().emoji[shortcode];
}

export function icon(name: string) {
  let svg = rendered.get(name);
  if (svg) {
    return svg;
  }
  const raw = source(name);
  if (!raw) {
    throw new Error(
      `Icon "${name}" not found. Icons download on the first build; check your network, or run: mise run icons`,
    );
  }
  svg = raw
    .replace(/\s+/g, " ")
    .replace(/>\s+</g, "><")
    .trim()
    .replace("<svg", `<svg class="icon icon-${name}" aria-hidden="true" focusable="false"`);
  rendered.set(name, svg);
  return svg;
}
