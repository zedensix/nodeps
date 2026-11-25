import { posix } from "node:path";
import { parseFrontmatter } from "../markdown/markdown.ts";
import { readEntries, type Resource } from "./resources.ts";
import type { Asset } from "./site.ts";

export interface Draft {
  source: string;
  modified: Date;
  raw: string;
  data: Record<string, unknown>;
  body: string;
}

const skillsIndex = `---
title: Skills
icon: brain-circuit
description: AI skills to download and install in Claude Code or any agent that reads SKILL.md.
---

# Skills
`;

/**
 * Gives every folder named `skills` that holds skill folders a page listing
 * them: its own `index.md` when it has one, otherwise a generated one. Either
 * page attaches every skill directly inside the folder unless its frontmatter
 * already lists `resources`.
 */
export function addSkillIndexes(drafts: Draft[], skills: Set<string>, sourceDirectory: string) {
  const byFolder = new Map<string, string[]>();
  for (const skill of skills) {
    const folder = posix.dirname(skill);
    if (posix.basename(folder) === "skills") {
      byFolder.set(folder, [...(byFolder.get(folder) ?? []), posix.basename(skill)]);
    }
  }
  for (const [folder, names] of byFolder) {
    const source = `${folder}/index.md`;
    let draft = drafts.find((candidate) => candidate.source === source);
    if (!draft) {
      const newest = Math.max(
        ...names.map((name) => Bun.file(`${sourceDirectory}/${folder}/${name}/SKILL.md`).lastModified),
      );
      draft = { source, modified: new Date(newest), raw: skillsIndex, ...parseFrontmatter(skillsIndex, source) };
      drafts.push(draft);
    }
    draft.data.resources ??= names.sort();
  }
}

/**
 * Lists the folders whose files are served as they are instead of becoming
 * pages: skill folders and every folder a page attaches with `resources`.
 */
export function servedFolders(drafts: Draft[], sourcePaths: string[], skills: Set<string>) {
  const served = new Set(skills);
  for (const draft of drafts) {
    for (const entry of readEntries(draft.data.resources, draft.source, [])) {
      const path = posix.normalize(posix.join(posix.dirname(draft.source), entry.path)).replace(/\/$/, "");
      if (sourcePaths.some((candidate) => candidate.startsWith(path + "/"))) {
        served.add(path);
      }
    }
  }
  return served;
}

/**
 * Packs every file of a folder into a gzipped tarball, rooted at the folder
 * name so it unpacks into a directory of its own.
 */
async function folderArchive(sourceDirectory: string, folder: string, files: Set<string>) {
  const name = posix.basename(folder);
  const entries: Record<string, Blob> = {};
  for (const file of files) {
    if (file.startsWith(folder + "/")) {
      entries[`${name}/${file.slice(folder.length + 1)}`] = Bun.file(`${sourceDirectory}/${file}`);
    }
  }
  return new Bun.Archive(entries, { compress: "gzip" }).blob();
}

/**
 * Builds the tarball of every folder and skill resource once, served at its
 * `archivePath`.
 */
export async function addArchives(
  resources: Resource[],
  sourceDirectory: string,
  sourceFiles: Set<string>,
  files: Map<string, Asset>,
) {
  for (const resource of resources) {
    if (resource.archivePath && !files.has("/" + resource.archivePath)) {
      const body = await folderArchive(sourceDirectory, resource.path, sourceFiles);
      files.set("/" + resource.archivePath, { body, type: "application/gzip", immutable: false });
    }
  }
}
