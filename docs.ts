#!/usr/bin/env bun
import { parseArgs } from "node:util";
import { loadConfig } from "./src/config/config.ts";
import { ConfigError } from "./src/config/config-fields.ts";
import { exportSite } from "./src/output/export.ts";
import { planMigration, renderConfig, writeMigration } from "./src/migrate/migrate.ts";
import { serve } from "./src/output/server.ts";
import { version } from "./src/version.ts";

const usage = `Usage: nodeps <command> [options]   (from source: bun docs.ts <command>)

Commands:
  dev      Serve the docs with live reload
  serve    Serve the docs (production, server-side rendered, MCP enabled)
  build    Export the docs as static files
  migrate  Convert an MkDocs or Zensical project: nodeps migrate [mkdocs.yml] [--write]

Options:
  -c, --config <file>   Config file (default: docs.yaml)
  -p, --port <port>     Port for dev and serve (default: $PORT or 3000)
      --host <host>     Hostname to bind (default: 0.0.0.0)
      --write           With migrate: write docs.yaml and add missing frontmatter
  -v, --version         Print the nodeps version
  -h, --help            Show this help`;

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  allowPositionals: true,
  options: {
    config: { type: "string", short: "c", default: "docs.yaml" },
    port: { type: "string", short: "p" },
    host: { type: "string" },
    help: { type: "boolean", short: "h" },
    version: { type: "boolean", short: "v" },
    write: { type: "boolean" },
  },
});

const command = positionals[0];
const port = values.port === undefined ? undefined : Number(values.port);

try {
  if (values.version) {
    console.log(version);
  } else if (values.help || !command) {
    console.log(usage);
  } else if (port !== undefined && !(Number.isInteger(port) && port >= 0 && port < 65536)) {
    throw new ConfigError(`--port must be a number between 0 and 65535, got "${values.port}"`);
  } else if (command === "dev" || command === "serve") {
    await serve(values.config, { dev: command === "dev", port, hostname: values.host });
  } else if (command === "build") {
    await exportSite(await loadConfig(values.config));
  } else if (command === "migrate") {
    const mkdocsPath = positionals[1] ?? "mkdocs.yml";
    const report = await planMigration(mkdocsPath);
    const section = (title: string, lines: string[]) =>
      lines.length > 0 && console.log(`\n${title}\n${lines.map((line) => `  ${line}`).join("\n")}`);
    section("Mapped to docs.yaml", report.mapped);
    section("Supported natively", report.native);
    section("Not supported", report.unsupported);
    section("Check by hand", report.warnings);
    section(
      values.write ? "Generated files" : "Files --write will generate",
      report.files.map((file) => file.path),
    );
    console.log(`\n${report.pages.length} pages need an icon and a byline in their frontmatter.`);
    if (values.write) {
      const target = await writeMigration(mkdocsPath, report);
      console.log(`Wrote ${target} and updated ${report.pages.length} pages. Check the result with: nodeps dev`);
    } else {
      console.log(`\ndocs.yaml preview:\n\n${renderConfig(report.config)}\nRun again with --write to apply.`);
    }
  } else {
    console.error(`Unknown command "${command}"\n\n${usage}`);
    process.exit(1);
  }
} catch (error) {
  console.error(`error: ${(error as Error).message}`);
  process.exit(1);
}
