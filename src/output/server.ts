import { existsSync, watch } from "node:fs";
import { basename, join } from "node:path";
import { handleMcp, llmsFull, llmsIndex, searchIndex } from "./ai.ts";
import { feed, robots, sitemap } from "./feeds.ts";
import { loadConfig, type Config } from "../config/config.ts";
import { editorHtml, editorPayload } from "../editor/editor.ts";
import { createEditorRoutes } from "../editor/editor-routes.ts";
import type { RenderOptions } from "../render/document.ts";
import { renderNotFound, renderPage } from "../render/layout.ts";
import { loadSite, type Site } from "../site/site.ts";
import { embeddedTheme, sourceRoot } from "../theme/theme.ts";

const html = "text/html;charset=utf-8";
const markdown = "text/markdown;charset=utf-8";
const plain = "text/plain;charset=utf-8";
const xml = "application/xml;charset=utf-8";

/**
 * Builds the request handler shared by the dev server, the production server
 * and the static export. Rendered HTML is cached per site object, so a reload
 * that produces a new site starts from an empty cache.
 */
export function createHandler(getSite: () => Site, options: RenderOptions) {
  const editorRoutes = options.server ? createEditorRoutes(getSite) : undefined;
  const rendered = new Map<string, string>();
  let renderedFor: Site | null = null;

  const cachedPage = (site: Site, key: string, render: () => string) => {
    if (renderedFor !== site) {
      rendered.clear();
      renderedFor = site;
    }
    let body = rendered.get(key);
    if (body === undefined) {
      body = render();
      rendered.set(key, body);
    }
    return body;
  };

  return async (request: Request): Promise<Response> => {
    const site = getSite();
    const { config } = site;
    const url = new URL(request.url);
    const origin = config.url ?? (options.server ? url.origin : "");
    const respond = (body: BodyInit, type: string, status = 200, headers: Record<string, string> = {}) =>
      new Response(body, { status, headers: { "content-type": type, ...headers } });

    let pathname: string;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      return respond("Bad request", plain, 400);
    }
    if (pathname + "/" === config.base) {
      return Response.redirect(config.base, 301);
    }
    if (!pathname.startsWith(config.base)) {
      return respond(
        cachedPage(site, "404", () => renderNotFound(site, options)),
        html,
        404,
      );
    }
    const path = "/" + pathname.slice(config.base.length);

    if (options.server && path === "/mcp") {
      return handleMcp(request, site, origin);
    }
    if (config.editor.enabled && path.startsWith("/_editor/source/") && path.endsWith(".json")) {
      const page = site.pages.find((candidate) => `/_editor/source/${candidate.source}.json` === path);
      if (page) {
        return Response.json(editorPayload(page), { headers: { "cache-control": "no-cache" } });
      }
    }
    if (options.server && config.editor.enabled && path === "/_editor/render" && request.method === "POST") {
      const input = (await request.json().catch(() => ({}))) as { markdown?: unknown };
      if (typeof input.markdown !== "string" || input.markdown.length > 1_000_000) {
        return Response.json({ error: "Expected { markdown }" }, { status: 400 });
      }
      return Response.json({ html: editorHtml(input.markdown) });
    }
    const editorResponse = await editorRoutes?.(request, path);
    if (editorResponse) {
      return editorResponse;
    }
    if (path === "/llms.txt") {
      return respond(llmsIndex(site, origin, options.server), plain);
    }
    if (path === "/llms-full.txt") {
      return respond(llmsFull(site, origin), plain);
    }
    if (path === "/search.json") {
      return Response.json(searchIndex(site));
    }
    if (path === "/robots.txt") {
      return respond(robots(site, origin), plain);
    }
    if (origin && path === "/sitemap.xml") {
      return respond(sitemap(site, origin), xml);
    }
    if (origin && path === "/feed.xml") {
      return respond(feed(site, origin), "application/rss+xml;charset=utf-8");
    }
    if (path === "/404.html") {
      return respond(
        cachedPage(site, "404", () => renderNotFound(site, options)),
        html,
      );
    }

    const file = site.files.get(path);
    if (file) {
      const cache = file.immutable ? "public, max-age=31536000, immutable" : "no-cache";
      return respond(file.body, file.type, 200, { "cache-control": cache });
    }

    const markdownPage = path.endsWith(".md") ? site.pages.find((page) => page.markdownUrl === path) : undefined;
    if (markdownPage) {
      return respond(markdownPage.markdown, markdown, 200, { "cache-control": "no-cache" });
    }

    const page = site.pageByUrl.get(path);
    if (page) {
      if (request.headers.get("accept")?.includes("text/markdown")) {
        return respond(page.markdown, markdown, 200, { vary: "accept", "cache-control": "no-cache" });
      }
      return respond(
        cachedPage(site, page.url, () => renderPage(site, page, options)),
        html,
        200,
        { vary: "accept", "cache-control": "no-cache" },
      );
    }
    if (site.pageByUrl.has(path + "/")) {
      return Response.redirect(config.base + path.slice(1) + "/" + url.search, 301);
    }

    return respond(
      cachedPage(site, "404", () => renderNotFound(site, options)),
      html,
      404,
    );
  };
}

/**
 * Prints the site's build warnings and how many pages it loaded, with the time
 * spent since `startedAt` (from `Bun.nanoseconds()`).
 */
function report(site: Site, startedAt: number) {
  for (const warning of site.warnings) {
    console.warn(`  warning: ${warning}`);
  }
  console.log(`  ${site.pages.length} pages in ${((Bun.nanoseconds() - startedAt) / 1e6).toFixed(0)}ms`);
}

/**
 * Loads the site and serves it with server-side features on. In dev mode it
 * also watches the docs, the theme and the config files, rebuilds the site on
 * change (debounced) and tells open pages to reload over a WebSocket.
 */
export async function serve(
  configPath: string,
  { dev, port, hostname }: { dev: boolean; port?: number; hostname?: string },
) {
  let config: Config = await loadConfig(configPath);
  let startedAt = Bun.nanoseconds();
  let site = await loadSite(config);
  report(site, startedAt);
  const handler = createHandler(() => site, { dev, server: true });

  const server = Bun.serve({
    port,
    hostname,
    /**
     * Upgrades dev live-reload requests to a WebSocket and hands every other
     * request to the site handler.
     */
    async fetch(request, server) {
      if (dev && new URL(request.url).pathname === config.base + "__reload" && server.upgrade(request)) {
        return undefined;
      }
      return handler(request);
    },
    websocket: {
      /**
       * Subscribes each live-reload socket to the topic a rebuild publishes on.
       */
      open(socket) {
        socket.subscribe("reload");
      },
      /**
       * Ignores messages: the socket only ever sends reload signals to the page.
       */
      message() {},
    },
  });
  console.log(`  ${dev ? "dev server" : "serving"} on ${server.url.href.replace(/\/$/, "")}${config.base}`);

  if (!dev) {
    return server;
  }

  let timer: Timer | undefined;
  const reload = (reason: string) => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        config = await loadConfig(configPath);
        startedAt = Bun.nanoseconds();
        site = await loadSite(config);
        console.log(`  reloaded (${reason})`);
        report(site, startedAt);
        server.publish("reload", "reload");
      } catch (error) {
        console.error(`  ${(error as Error).message}`);
      }
    }, 40);
  };
  watch(config.source, { recursive: true }, (_event, file) => reload(String(file)));
  if (!embeddedTheme) {
    for (const folder of ["themes", "client"]) {
      watch(join(sourceRoot(), folder), { recursive: true }, (_event, file) => reload(`${folder}/${file}`));
    }
  }
  const themesDirectory = join(config.root, "themes");
  if (existsSync(themesDirectory)) {
    watch(themesDirectory, { recursive: true }, (_event, file) => reload(`themes/${file}`));
  }
  watch(config.root, (_event, file) => {
    if (file === basename(config.file) || (config.theme.stylesheet && file === basename(config.theme.stylesheet))) {
      reload(String(file));
    }
  });
  return server;
}
