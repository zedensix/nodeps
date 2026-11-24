#!/usr/bin/env bun
//MISE description="Download every icon set again into theme/icons (builds do it automatically when missing)"
import { join } from "node:path";
import { downloadIcons } from "../../src/icon-download.ts";

await downloadIcons(join(process.env.MISE_PROJECT_ROOT ?? process.cwd(), "theme/icons"));
