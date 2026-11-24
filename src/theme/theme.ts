import { cp, mkdtemp, realpath, rm } from "node:fs/promises";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import type { ThemeDefinition } from "./themes.ts";

export interface BundledAsset {
  body: string;
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
 * Bundles an HTML or script entrypoint for the browser with Bun.build into
 * content-hashed files. Returns the HTML text as the entry for an HTML
 * entrypoint, otherwise the public URL of the entry script.
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
  let entry = "";
  for (const output of result.outputs) {
    const name = output.path.replace(/^\.\//, "");
    if (output.kind === "entry-point" && name.endsWith(".html")) {
      entry = await output.text();
    } else {
      assets.set(name, { body: await output.text(), type: output.type });
    }
    if (output.kind === "entry-point" && !name.endsWith(".html")) {
      entry ||= publicPath + name;
    }
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
