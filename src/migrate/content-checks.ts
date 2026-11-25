import { join } from "node:path";
import type { NavEntry } from "../config/config.ts";
import { isAdmonitionType } from "../markdown/block-extensions.ts";
import type { MigrationReport } from "./migrate.ts";

/**
 * Drops the nav entries that point inside an AI skill folder, which nodeps
 * serves as files rather than pages, and the sections left empty. Warns once
 * per skill with the way to attach it instead.
 */
export function dropSkillEntries(entries: NavEntry[], skills: Set<string>, warnings: string[]): NavEntry[] {
  return entries.flatMap((entry): NavEntry[] => {
    const [title, target] = typeof entry === "string" ? ["", entry] : Object.entries(entry)[0]!;
    if (Array.isArray(target)) {
      const children = dropSkillEntries(target, skills, warnings);
      return children.length > 0 ? [{ [title]: children }] : [];
    }
    const path = target.replace(/^\.?\//, "");
    const skill = [...skills].find((folder) => path.startsWith(folder + "/"));
    if (!skill) {
      return [entry];
    }
    const message = `nav: ${skill} is an AI skill, so its files were left out of nav: nodeps serves a skill as a download, not as pages. Attach the folder to a page with resources (see how-to/attach-resources); links to its SKILL.md keep working.`;
    if (!warnings.includes(message)) {
      warnings.push(message);
    }
    return [];
  });
}

/**
 * Warns about the admonition types the pages use that nodeps has no style for,
 * naming the first page using each.
 */
export async function warnUnknownAdmonitions(source: string, paths: string[], report: MigrationReport) {
  const unknown = new Map<string, string>();
  for (const path of paths) {
    const text = await Bun.file(join(source, path)).text();
    for (const [, type] of text.matchAll(/^[ \t]*(?:!!!|\?\?\?\+?)[ \t]+([\w-]+)/gm)) {
      if (!isAdmonitionType(type!) && !unknown.has(type!)) {
        unknown.set(type!, path);
      }
    }
  }
  for (const [type, path] of unknown) {
    report.warnings.push(
      `admonition type "${type}" (first used in ${path}) has no nodeps style, so it renders as a note. Use one of the types listed in reference/markdown/admonitions.`,
    );
  }
}
