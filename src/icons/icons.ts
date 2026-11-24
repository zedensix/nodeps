import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import { embeddedTheme } from "../theme/theme.ts";

export const iconDirectory = `${import.meta.dir}/../../icons`;

let lucideFiles: Map<string, string> | undefined;
let extras: { icons: Record<string, string>; emoji: Record<string, string> } | undefined;
const rendered = new Map<string, string>();

/**
 * Maps each Lucide icon name to its SVG file under the theme icon folder,
 * scanned once. Empty in a compiled binary, which embeds the icons instead.
 */
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

/**
 * Decompresses the bundle of non-Lucide icons and emoji shortcodes once, from
 * the binary when embedded or from disk. Falls back to empty maps when the
 * icons have not been downloaded yet.
 */
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

/**
 * Reads every Lucide SVG into a name-to-source map, for embedding in a
 * compiled binary.
 */
export function readIconSources() {
  return Object.fromEntries([...lucide()].map(([name, path]) => [name, readFileSync(path, "utf8")]));
}

/**
 * Reads the compressed extra icon bundle as base64, for embedding in a
 * compiled binary without decompressing it.
 */
export function readExtraBundle() {
  return readFileSync(`${iconDirectory}/extra.json.zst`).toString("base64");
}

/**
 * Returns the raw SVG of an icon: embedded first, then the Lucide file, then
 * the extra bundle. Undefined when no set has it.
 */
function source(name: string) {
  if (embeddedTheme?.icons[name]) {
    return embeddedTheme.icons[name];
  }
  const path = lucide().get(name);
  return path ? readFileSync(path, "utf8") : extraBundle().icons[name];
}

/**
 * Turns an icon reference into its lookup key: drops a `lucide/` or `lucide-`
 * prefix and replaces slashes with dashes, so `material/home` becomes `material-home`.
 */
export function normalizeIcon(name: string) {
  const key = name
    .trim()
    .replace(/^lucide[/-]/, "")
    .split("/")
    .join("-");
  return key;
}

/**
 * Tells whether an icon exists in any set, without reading or rendering it.
 */
export function isIcon(name: string) {
  return (embeddedTheme ? name in embeddedTheme.icons : lucide().has(name)) || name in extraBundle().icons;
}

/**
 * Returns the emoji for a gemoji shortcode such as `tada`, or undefined.
 */
export function emoji(shortcode: string): string | undefined {
  return extraBundle().emoji[shortcode];
}

/**
 * Returns an icon as inline SVG, minified, hidden from assistive technology and
 * tagged with `icon icon-<name>` classes. Results are cached. Throws when the
 * icon does not exist, which fails the build.
 */
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
