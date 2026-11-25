import type { Config } from "../config/config.ts";
import type { Asset } from "./site.ts";

/**
 * Checks that `logo`, `logo_dark` and `favicon` name image files inside the
 * source directory, throwing with the setting and the path otherwise. Serves
 * the favicon, or else the logo, as `/favicon.ico` when the source has none,
 * so the request browsers make on their own does not fail.
 */
export function addBrandImages(config: Config, files: Map<string, Asset>) {
  const images = { logo: config.logo, logo_dark: config.logoDark, favicon: config.favicon };
  for (const [setting, path] of Object.entries(images)) {
    const asset = path ? files.get("/" + path.replace(/^\.?\//, "")) : undefined;
    if (path && !asset) {
      throw new Error(`docs.yaml: ${setting} not found: ${path} (a path inside ${config.source})`);
    }
    if (path && !asset!.type.startsWith("image/")) {
      throw new Error(`docs.yaml: ${setting} is not an image (png, jpg, gif, webp, svg or ico): ${path}`);
    }
  }
  const favicon = config.favicon ?? config.logo;
  if (favicon && !files.has("/favicon.ico")) {
    files.set("/favicon.ico", files.get("/" + favicon.replace(/^\.?\//, ""))!);
  }
}
