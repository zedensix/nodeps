#!/usr/bin/env bun
//MISE description="Download every Lucide icon into theme/icons, one folder per category, plus git provider logos from Simple Icons"
//USAGE arg "[version]" help="Lucide release to download" default="1.79.0"
import { $ } from "bun";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

const version = process.env.usage_version ?? Bun.argv[2] ?? "1.79.0";
const target = join(process.env.MISE_PROJECT_ROOT ?? process.cwd(), "theme/icons");
const temporary = await mkdtemp(join(tmpdir(), "lucide-"));
const brandsVersion = "16.38.1";
const brands = ["github", "gitlab", "gitea", "bitbucket"];

async function download(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GET ${url} failed: ${response.status} ${response.statusText}`);
  }
  return response;
}

try {
  const archive = join(temporary, "icons.zip");
  await Bun.write(
    archive,
    await download(`https://github.com/lucide-icons/lucide/releases/download/${version}/lucide-icons-${version}.zip`),
  );
  await $`unzip -q -j ${archive} 'icons/*' -d ${join(temporary, "icons")}`;
  await rm(target, { recursive: true, force: true });

  const categories = new Map<string, number>();
  for (const svg of new Bun.Glob("*.svg").scanSync({ cwd: join(temporary, "icons"), absolute: true })) {
    const name = basename(svg, ".svg");
    const metadata = Bun.file(svg.replace(/\.svg$/, ".json"));
    const listed: string[] = (await metadata.exists()) ? ((await metadata.json()).categories ?? []) : [];
    const category = listed.find((entry) => !entry.startsWith("$")) ?? "uncategorized";
    categories.set(category, (categories.get(category) ?? 0) + 1);
    await Bun.write(join(target, category, `${name}.svg`), Bun.file(svg));
  }

  await Bun.write(
    join(target, "LICENSE"),
    await download(`https://raw.githubusercontent.com/lucide-icons/lucide/${version}/LICENSE`),
  );
  await Bun.write(join(target, "VERSION"), `${version}\n`);

  const brandsUrl = `https://raw.githubusercontent.com/simple-icons/simple-icons/${brandsVersion}`;
  for (const brand of brands) {
    const svg = await (await download(`${brandsUrl}/icons/${brand}.svg`)).text();
    const cleaned = svg
      .replace(/<title>.*?<\/title>/, "")
      .replace(' role="img"', "")
      .replace("<svg", '<svg fill="currentColor"');
    await Bun.write(join(target, "brands", `${brand}.svg`), cleaned);
  }
  await Bun.write(join(target, "brands", "LICENSE.md"), await download(`${brandsUrl}/LICENSE.md`));
  const total = [...categories.values()].reduce((sum, count) => sum + count, 0);
  console.log(`Lucide ${version}: ${total} icons in ${categories.size} categories in ${target}`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
