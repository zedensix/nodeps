#!/usr/bin/env bun
//MISE description="Compile nodeps into standalone binaries in build/, embedding the theme and icons"
import { join } from "node:path";
import { ensureIcons } from "../../src/icon-download.ts";
import { iconDirectory, readExtraBundle, readIconSources } from "../../src/icons.ts";
import { bundle, embeddedBase, themeDirectory, type EmbeddedTheme } from "../../src/theme.ts";

const root = process.env.MISE_PROJECT_ROOT ?? process.cwd();
const targets = Bun.argv.slice(2);

await ensureIcons(iconDirectory);
const layout = await bundle(`${themeDirectory}/layout.html`, embeddedBase + "_assets/");
const embedded: EmbeddedTheme = {
  template: layout.entry,
  assets: Object.fromEntries(layout.assets),
  icons: readIconSources(),
  extras: readExtraBundle(),
};

for (const target of targets.length > 0 ? targets : [undefined]) {
  const outfile = join(root, "build", target ? `nodeps-${target.replace(/^bun-/, "")}` : "nodeps");
  const result = await Bun.build({
    entrypoints: [join(root, "docs.ts")],
    compile: target ? { target: target as Bun.Build.CompileTarget, outfile } : { outfile },
    minify: true,
    define: { NODEPS_EMBEDDED_THEME: JSON.stringify(embedded) },
    throw: false,
  });
  if (!result.success) {
    console.error(result.logs.join("\n"));
    process.exit(1);
  }
  console.log(`${target ?? "host"}: ${result.outputs[0]?.path ?? outfile}`);
}
