import type { NavItem, Page, Site } from "./site.ts";
import { searchEntries, snippet, type SearchEntry } from "../theme/search.ts";

export function pageHref(site: Site, page: Page) {
  return site.config.base + page.url.slice(1);
}

export function markdownHref(site: Site, page: Page) {
  return site.config.base + page.markdownUrl.slice(1);
}

export function searchIndex(site: Site): SearchEntry[] {
  return site.pages.flatMap((page) =>
    page.sections.map((section) => ({
      title: page.title,
      heading: section.heading,
      url: pageHref(site, page) + (section.id ? `#${section.id}` : ""),
      text: section.text,
    })),
  );
}

export function llmsIndex(site: Site, origin: string, mcp: boolean) {
  const { config } = site;
  const lines = [`# ${config.title}`, ""];
  if (config.description) {
    lines.push(`> ${config.description}`, "");
  }
  if (config.repository) {
    lines.push(`Source repository: ${config.repository.url}`, "");
  }
  lines.push(
    `Every page is available as Markdown by replacing the trailing slash of its URL with \`.md\`. The full documentation in one file: ${origin}${config.base}llms-full.txt`,
    "",
  );
  if (mcp) {
    lines.push(
      `An MCP server (Streamable HTTP) is available at ${origin}${config.base}mcp with the tools \`search_docs\`, \`read_page\` and \`list_pages\`.`,
      "",
    );
  }
  const link = (page: Page, depth: number) =>
    `${"  ".repeat(depth)}- [${page.title}](${origin}${markdownHref(site, page)})${page.description ? `: ${page.description}` : ""}`;
  const listItems = (items: NavItem[], depth: number) => {
    for (const item of items) {
      if (item.kind === "page") {
        lines.push(link(item.page, depth));
      } else {
        lines.push(item.index ? link(item.index, depth) : `${"  ".repeat(depth)}- ${item.title}`);
        listItems(item.children, depth + 1);
      }
    }
  };
  for (const category of site.categories) {
    lines.push(`## ${category.title}`, "");
    listItems(category.items, 0);
    lines.push("");
  }
  return lines.join("\n");
}

export function llmsFull(site: Site, origin: string) {
  return site.navPages
    .map((page) => `${page.markdown.trim()}\n\nSource: ${origin}${pageHref(site, page)}`)
    .join("\n\n---\n\n");
}

const protocolVersions = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

const tools = [
  {
    name: "search_docs",
    description:
      "Full-text search over the documentation. Returns the best matching sections with their URL and an excerpt.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Words to look for" },
        limit: { type: "number", description: "Maximum number of results, 10 by default" },
      },
      required: ["query"],
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "read_page",
    description:
      "Read one documentation page as Markdown. Accepts a page URL or path, with or without the .md suffix or #anchor.",
    inputSchema: {
      type: "object",
      properties: { path: { type: "string", description: "For example /guide/setup/ or guide/setup.md" } },
      required: ["path"],
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "list_pages",
    description: "List every documentation page with its title, path and description, in sidebar order.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
  },
];

function findPage(site: Site, path: string) {
  let url = path.trim();
  if (URL.canParse(url)) {
    url = new URL(url).pathname;
  }
  url = url.split("#")[0]!.split("?")[0]!;
  if (url.startsWith(site.config.base)) {
    url = url.slice(site.config.base.length);
  }
  url = "/" + url.replace(/^\/+/, "");
  url = url.replace(/(?:\/index)?\.md$/, "/").replace(/\/?$/, "/");
  return site.pageByUrl.get(url === "//" ? "/" : url);
}

function callTool(site: Site, name: string, input: Record<string, unknown>, origin: string) {
  if (name === "search_docs") {
    const query = String(input.query ?? "");
    const limit = Math.min(Math.max(Number(input.limit) || 10, 1), 50);
    const results = searchEntries(searchIndex(site), query, limit);
    if (results.length === 0) {
      return `No results for "${query}".`;
    }
    return results
      .map(
        (entry) =>
          `## ${entry.heading ? `${entry.title} › ${entry.heading}` : entry.title}\n${origin}${entry.url}\n\n${snippet(entry.text, query, 200)}`,
      )
      .join("\n\n");
  }
  if (name === "read_page") {
    const page = findPage(site, String(input.path ?? ""));
    if (!page) {
      throw new Error(`No page at "${input.path}". Use list_pages to see the available paths.`);
    }
    return page.markdown;
  }
  if (name === "list_pages") {
    return site.navPages
      .map((page) => `- ${page.title}: ${pageHref(site, page)}${page.description ? ` (${page.description})` : ""}`)
      .join("\n");
  }
  throw new Error(`Unknown tool: ${name}`);
}

interface JsonRpcMessage {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

const rpcError = (id: JsonRpcMessage["id"], code: number, message: string) =>
  Response.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

export async function handleMcp(request: Request, site: Site, origin: string) {
  const requestOrigin = request.headers.get("origin");
  if (requestOrigin && new URL(requestOrigin).host !== new URL(request.url).host && requestOrigin !== site.config.url) {
    return new Response("Forbidden origin", { status: 403 });
  }
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: { allow: "POST" } });
  }

  let message: JsonRpcMessage;
  try {
    message = await request.json();
  } catch {
    return rpcError(null, -32700, "Parse error");
  }
  if (typeof message !== "object" || message === null || Array.isArray(message) || typeof message.method !== "string") {
    return rpcError(null, -32600, "Invalid request");
  }
  if (message.id === undefined) {
    return new Response(null, { status: 202 });
  }

  const reply = (result: unknown) => Response.json({ jsonrpc: "2.0", id: message.id, result });
  const params = message.params ?? {};
  switch (message.method) {
    case "initialize": {
      const requested = String(params.protocolVersion ?? "");
      return reply({
        protocolVersion: protocolVersions.includes(requested) ? requested : protocolVersions[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: site.config.title, version: "1.0.0" },
        instructions: `Documentation for ${site.config.title}. Use search_docs to find relevant sections, then read_page to read a full page.`,
      });
    }
    case "ping":
      return reply({});
    case "tools/list":
      return reply({ tools });
    case "tools/call": {
      try {
        const text = callTool(site, String(params.name), (params.arguments as Record<string, unknown>) ?? {}, origin);
        return reply({ content: [{ type: "text", text }] });
      } catch (error) {
        return reply({ content: [{ type: "text", text: (error as Error).message }], isError: true });
      }
    }
    default:
      return rpcError(message.id, -32601, `Method not found: ${message.method}`);
  }
}
