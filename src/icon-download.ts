import { mkdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";

export const iconSources = {
  lucide: { repository: "lucide-icons/lucide", tag: "1.79.0" },
  material: { repository: "Templarian/MaterialDesign-SVG", tag: "v7.4.47" },
  octicons: { repository: "primer/octicons", tag: "v19.33.0" },
  fontawesome: { repository: "FortAwesome/Font-Awesome", tag: "7.3.1" },
  simple: { repository: "simple-icons/simple-icons", tag: "16.38.1" },
  gemoji: { repository: "github/gemoji", tag: "v4.1.0" },
};

const sets = [
  { name: "material", glob: "*/svg/*.svg", license: "LICENSE" },
  { name: "octicons", glob: "*/icons/*.svg", license: "LICENSE" },
  { name: "fontawesome", glob: "*/svgs/*/*.svg", license: "LICENSE.txt" },
  { name: "simple", glob: "*/icons/*.svg", license: "LICENSE.md" },
] as const;

const stamp = JSON.stringify(iconSources);

async function tarball(source: { repository: string; tag: string }) {
  const url = `https://codeload.github.com/${source.repository}/tar.gz/refs/tags/${source.tag}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Downloading icons failed: GET ${url} answered ${response.status}`);
  }
  return new Bun.Archive(await response.bytes());
}

function minify(svg: string) {
  return svg
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<title>[\s\S]*?<\/title>/g, "")
    .replace(/\s(width|height|role|class)="[^"]*"/g, "")
    .replace(/\s+/g, " ")
    .replace(/>\s+</g, "><")
    .trim();
}

function withFill(svg: string) {
  return /<svg[^>]*\sfill=/.test(svg) ? svg : svg.replace("<svg", '<svg fill="currentColor"');
}

export async function downloadIcons(target: string, log: (message: string) => void = console.log) {
  const staging = `${target}.download`;
  await rm(staging, { recursive: true, force: true });
  await mkdir(join(staging, "licenses"), { recursive: true });

  const lucide = await tarball(iconSources.lucide);
  const lucideFiles = await lucide.files(["*/icons/*.svg", "*/icons/*.json", "*/LICENSE"]);
  const metadata = new Map<string, string[]>();
  for (const [path, file] of lucideFiles) {
    if (path.endsWith(".json")) {
      metadata.set(
        path.replace(/\.json$/, ".svg"),
        ((await file.json()) as { categories?: string[] }).categories ?? [],
      );
    }
  }
  let lucideCount = 0;
  for (const [path, file] of lucideFiles) {
    if (path.endsWith("/LICENSE")) {
      await Bun.write(join(staging, "licenses", "lucide.LICENSE"), file);
    } else if (path.endsWith(".svg")) {
      const category = metadata.get(path)?.find((entry) => !entry.startsWith("$")) ?? "uncategorized";
      await Bun.write(join(staging, category, path.split("/").at(-1)!), await file.text());
      lucideCount++;
    }
  }
  log(`  icons: Lucide ${iconSources.lucide.tag}, ${lucideCount} icons`);

  const extras: Record<string, string> = {};
  for (const set of sets) {
    const archive = await tarball(iconSources[set.name]);
    let count = 0;
    for (const [path, file] of await archive.files([set.glob, `*/${set.license}`])) {
      const relative = path.split("/").slice(1).join("/");
      if (relative === set.license) {
        await Bun.write(join(staging, "licenses", `${set.name}.LICENSE`), file);
        continue;
      }
      const segments = relative.replace(/\.svg$/, "").split("/");
      const name = set.name === "fontawesome" ? segments.slice(-2).join("-") : segments.at(-1)!;
      extras[`${set.name}-${name}`] = withFill(minify(await file.text()));
      count++;
    }
    log(`  icons: ${set.name} ${iconSources[set.name].tag}, ${count} icons`);
  }

  const gemoji = await tarball(iconSources.gemoji);
  const emoji: Record<string, string> = {};
  for (const [path, file] of await gemoji.files(["*/db/emoji.json", "*/LICENSE"])) {
    if (path.endsWith("/LICENSE")) {
      await Bun.write(join(staging, "licenses", "gemoji.LICENSE"), file);
      continue;
    }
    for (const entry of (await file.json()) as { emoji: string; aliases: string[] }[]) {
      for (const alias of entry.aliases) {
        emoji[alias] = entry.emoji;
      }
    }
  }
  log(`  icons: gemoji ${iconSources.gemoji.tag}, ${Object.keys(emoji).length} shortcodes`);

  await Bun.write(
    join(staging, "extra.json.zst"),
    Bun.zstdCompressSync(Buffer.from(JSON.stringify({ icons: extras, emoji })), { level: 19 }),
  );
  await Bun.write(join(staging, "VERSION"), stamp);
  await rm(target, { recursive: true, force: true });
  await rename(staging, target);
}

export async function ensureIcons(target: string, log: (message: string) => void = console.log) {
  const current = Bun.file(join(target, "VERSION"));
  if ((await current.exists()) && (await current.text()) === stamp) {
    return;
  }
  log("  icons: downloading the icon sets once, this takes a few seconds");
  await downloadIcons(target, log);
}
