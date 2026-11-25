import { cp, mkdtemp, realpath, rm } from "node:fs/promises";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join, relative } from "node:path";
import type { FontSetting } from "../config/config-fields.ts";
import type { Theme } from "../config/config.ts";
import type { ThemeDefinition } from "./themes.ts";

export interface BundledAsset {
  body: string | Blob;
  type: string;
}

export interface FontPreload {
  href: string;
  type: string;
}

export interface Bundle {
  entry: string;
  assets: Map<string, BundledAsset>;
}

export interface EmbeddedTheme {
  sources: Record<string, string>;
  icons: Record<string, string>;
  extras: string;
}

declare const NODEPS_EMBEDDED_THEME: EmbeddedTheme | undefined;

export const embeddedTheme: EmbeddedTheme | undefined =
  typeof NODEPS_EMBEDDED_THEME === "undefined" ? undefined : NODEPS_EMBEDDED_THEME;

let unpackedRoot: string | undefined;

/**
 * Folder holding the built-in `themes/` and the browser `client/` sources.
 * From a checkout it is the repository; a compiled binary unpacks its
 * embedded copy once into a temp folder named after the content hash.
 */
export function sourceRoot() {
  if (!embeddedTheme) {
    return join(import.meta.dir, "../..");
  }
  if (!unpackedRoot) {
    const hash = Bun.hash(JSON.stringify(embeddedTheme.sources)).toString(36);
    unpackedRoot = join(tmpdir(), `nodeps-${hash}`);
    if (!existsSync(join(unpackedRoot, ".complete"))) {
      for (const [path, text] of Object.entries(embeddedTheme.sources)) {
        mkdirSync(dirname(join(unpackedRoot, path)), { recursive: true });
        writeFileSync(join(unpackedRoot, path), text);
      }
      writeFileSync(join(unpackedRoot, ".complete"), "");
    }
  }
  return unpackedRoot;
}

/**
 * Bundles an HTML, script or stylesheet entrypoint for the browser with
 * Bun.build into content-hashed files. Returns the HTML text as the entry for
 * an HTML entrypoint, otherwise the public URL of the entry file. The entry is
 * found by name and extension, as Bun reports a CSS-only entrypoint as an
 * asset; a build without one throws.
 */
export async function bundle(entrypoint: string, publicPath: string): Promise<Bundle> {
  const result = await Bun.build({
    entrypoints: [entrypoint],
    target: "browser",
    minify: true,
    splitting: true,
    publicPath,
    naming: "[name]-[hash].[ext]",
    throw: false,
  });
  if (!result.success) {
    throw new Error(`Failed to build ${entrypoint}:\n${result.logs.join("\n")}`);
  }
  const assets = new Map<string, BundledAsset>();
  const stem = basename(entrypoint).replace(/\.[^.]+$/, "");
  const extension = /\.(html|css)$/.exec(entrypoint)?.[0] ?? ".js";
  let entry = "";
  for (const output of result.outputs) {
    const name = output.path.replace(/^\.\//, "");
    const isEntry =
      !entry && name.endsWith(extension) && (output.kind === "entry-point" || basename(name).startsWith(`${stem}-`));
    if (isEntry && extension === ".html") {
      entry = await output.text();
      continue;
    }
    assets.set(name, { body: await output.text(), type: output.type });
    if (isEntry) {
      entry = publicPath + name;
    }
  }
  if (!entry) {
    throw new Error(`Building ${entrypoint} produced no ${extension} entry file`);
  }
  return { entry, assets };
}

/**
 * Replaces each `<nodeps-partial name="x"></nodeps-partial>` with the theme's
 * `x.html`, recursively and indented like the tag, so a theme can override one
 * piece of the page.
 */
function includePartials(html: string, directory: string, depth = 0): string {
  const tag = /^([ \t]*)<nodeps-partial\s+name="([\w-]+)"\s*><\/nodeps-partial>$/gm;
  return html.replace(tag, (_match, indent: string, name: string) => {
    const file = join(directory, `${name}.html`);
    if (depth > 8 || !existsSync(file)) {
      throw new Error(
        depth > 8 ? `Theme partials nest too deep at ${name}.html` : `Theme partial not found: ${name}.html`,
      );
    }
    const partial = includePartials(readFileSync(file, "utf8").trimEnd(), directory, depth + 1);
    return partial.replace(/^(?=.)/gm, indent);
  });
}

/**
 * Builds a theme: copies its folders into a temp folder, least specific first
 * so overrides win file by file, inlines the partials, adds the nodeps client
 * script and bundles `layout.html` with everything it references.
 */
export async function bundleTheme(theme: ThemeDefinition, publicPath: string): Promise<Bundle> {
  const directory = await realpath(await mkdtemp(join(tmpdir(), "nodeps-theme-")));
  try {
    for (const source of theme.directories.toReversed()) {
      await cp(source, directory, { recursive: true, force: true });
    }
    const layout = join(directory, "layout.html");
    if (!existsSync(layout)) {
      throw new Error(`Theme ${theme.name} has no layout.html`);
    }
    const client = relative(directory, join(sourceRoot(), "client", "client.ts"));
    const html = includePartials(readFileSync(layout, "utf8"), directory).replace(
      "</head>",
      `<script type="module" src="${client}"></script></head>`,
    );
    writeFileSync(layout, html);
    return await bundle(layout, publicPath);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

const fontTypes: Record<string, string> = {
  woff2: "font/woff2",
  woff: "font/woff",
  truetype: "font/ttf",
  opentype: "font/otf",
};

/**
 * Serves each font file under a content-hashed name and writes one
 * `@font-face` per file, with `font-display: swap`, into a hashed stylesheet.
 * Bun's CSS bundler would inline the fonts as data URLs, so this skips it.
 * Returns the stylesheet, the assets and the body font's first file to preload.
 */
async function bundleFonts(fonts: FontSetting[], publicPath: string): Promise<Bundle & { preload?: FontPreload }> {
  const assets = new Map<string, BundledAsset>();
  const faces: string[] = [];
  let preload: FontPreload | undefined;
  for (const font of fonts) {
    for (const file of font.files) {
      const body = Bun.file(file.path);
      const name = `${basename(file.path, extname(file.path))}-${Bun.hash(await body.bytes()).toString(36)}${extname(file.path)}`;
      assets.set(name, { body, type: fontTypes[file.format]! });
      const declarations = [
        `font-family: ${JSON.stringify(font.family)}`,
        `src: url("${publicPath + name}") format("${file.format}")`,
        file.weight ? `font-weight: ${file.weight}` : "",
        file.style ? `font-style: ${file.style}` : "",
        "font-display: swap",
      ];
      faces.push(`@font-face { ${declarations.filter(Boolean).join("; ")}; }`);
      if (font.role === "font" && !preload) {
        preload = { href: publicPath + name, type: fontTypes[file.format]! };
      }
    }
  }
  const css = faces.join("\n") + "\n";
  const stylesheet = `fonts-${Bun.hash(css).toString(36)}.css`;
  assets.set(stylesheet, { body: css, type: "text/css;charset=utf-8" });
  return { entry: publicPath + stylesheet, assets, preload };
}

/**
 * Bundles everything the site's pages load: the theme layout with the client
 * script, the generated font faces and `theme.stylesheet`, in that cascade
 * order. Returns the page template, the stylesheet URLs, the font to preload
 * and every asset. A missing stylesheet throws with its path.
 */
export async function bundleSiteTheme(theme: Theme, publicPath: string) {
  if (theme.stylesheet && !existsSync(theme.stylesheet)) {
    throw new Error(`docs.yaml: theme.stylesheet not found: ${theme.stylesheet}`);
  }
  const [layout, fonts, stylesheet] = await Promise.all([
    bundleTheme(theme, publicPath),
    theme.fonts.length > 0 ? bundleFonts(theme.fonts, publicPath) : undefined,
    theme.stylesheet ? bundle(theme.stylesheet, publicPath) : undefined,
  ]);
  return {
    template: layout.entry,
    stylesheets: [fonts?.entry, stylesheet?.entry].filter((entry) => entry !== undefined),
    fontPreload: fonts?.preload,
    assets: [...layout.assets, ...(fonts?.assets ?? []), ...(stylesheet?.assets ?? [])],
  };
}
