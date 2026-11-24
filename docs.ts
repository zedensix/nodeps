#!/usr/bin/env bun
import { parseArgs } from "node:util";
import { ConfigError, loadConfig } from "./src/config.ts";
import { exportSite } from "./src/export.ts";
import { serve } from "./src/server.ts";

const usage = `Usage: nodeps <command> [options]   (from source: bun docs.ts <command>)

Commands:
  dev      Serve the docs with live reload
  serve    Serve the docs (production, server-side rendered, MCP enabled)
  build    Export the docs as static files

Options:
  -c, --config <file>   Config file (default: docs.yaml)
  -p, --port <port>     Port for dev and serve (default: $PORT or 3000)
      --host <host>     Hostname to bind (default: 0.0.0.0)
  -h, --help            Show this help`;

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  allowPositionals: true,
  options: {
    config: { type: "string", short: "c", default: "docs.yaml" },
    port: { type: "string", short: "p" },
    host: { type: "string" },
    help: { type: "boolean", short: "h" },
  },
});

const command = positionals[0];
const port = values.port === undefined ? undefined : Number(values.port);

try {
  if (values.help || !command) {
    console.log(usage);
  } else if (port !== undefined && !(Number.isInteger(port) && port >= 0 && port < 65536)) {
    throw new ConfigError(`--port must be a number between 0 and 65535, got "${values.port}"`);
  } else if (command === "dev" || command === "serve") {
    await serve(values.config, { dev: command === "dev", port, hostname: values.host });
  } else if (command === "build") {
    await exportSite(await loadConfig(values.config));
  } else {
    console.error(`Unknown command "${command}"\n\n${usage}`);
    process.exit(1);
  }
} catch (error) {
  console.error(`error: ${(error as Error).message}`);
  process.exit(1);
}
