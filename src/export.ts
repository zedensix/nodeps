import { rm } from "node:fs/promises";
import { join } from "node:path";
import type { Config } from "./config.ts";
import { editorSourcePath } from "./editor.ts";
import { createHandler } from "./server.ts";
import { loadSite } from "./site.ts";

function outputPath(path: string) {
  return path.endsWith("/") ? path + "index.html" : path;
}

export async function exportSite(config: Config) {
  const startedAt = Bun.nanoseconds();
  const site = await loadSite(config);
  const handler = createHandler(() => site, { dev: false, server: false });
  const paths = [
    ...site.pages.flatMap((page) => [page.url, page.markdownUrl]),
    ...site.files.keys(),
    "/404.html",
    "/llms.txt",
    "/llms-full.txt",
    "/search.json",
    ...(config.editor.enabled ? site.pages.map(editorSourcePath) : []),
  ];

  await rm(config.output, { recursive: true, force: true });
  await Promise.all(
    paths.map(async (path) => {
      const response = await handler(new Request(`http://localhost${config.base}${path.slice(1)}`));
      if (!response.ok) {
        throw new Error(`${path} responded ${response.status}`);
      }
      await Bun.write(join(config.output, outputPath(path)), response);
    }),
  );

  for (const warning of site.warnings) {
    console.warn(`  warning: ${warning}`);
  }
  console.log(
    `  ${site.pages.length} pages, ${paths.length} files in ${config.output} (${((Bun.nanoseconds() - startedAt) / 1e6).toFixed(0)}ms)`,
  );
  return site;
}
