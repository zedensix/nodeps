import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { ExtensionContext } from "./extensions.ts";

/**
 * Finds the file a snippet reference points to, trying the page's folder, the
 * docs source folder, then the project root. Files outside the root are never
 * returned, so a snippet cannot read arbitrary paths.
 */
function snippetPath(reference: string, context: ExtensionContext) {
  const [file] = reference.split(":");
  const candidates = [
    join(context.sourceDirectory, dirname(context.pageSource), file!),
    join(context.sourceDirectory, file!),
    join(context.root, file!),
  ];
  return candidates.find((candidate) => resolve(candidate).startsWith(resolve(context.root)) && existsSync(candidate));
}

/**
 * Reads the lines of a `file:start:end` reference, expanding snippets nested in
 * it up to four levels deep. A missing file adds a warning and yields nothing.
 */
function readSnippet(reference: string, context: ExtensionContext, depth: number): string[] {
  const path = snippetPath(reference, context);
  if (!path) {
    context.warnings.push(`${context.pageSource}: snippet not found: ${reference}`);
    return [];
  }
  const [, start, end] = reference.split(":");
  let lines = readFileSync(path, "utf8").replace(/\n$/, "").split("\n");
  if (start || end) {
    lines = lines.slice(start ? Number(start) - 1 : 0, end ? Number(end) : undefined);
  }
  return depth < 4 ? expandSnippets(lines, context, depth + 1) : lines;
}

/**
 * Replaces pymdownx.snippets `--8<--` lines, single-line or block form, with
 * the included file content at the marker's indent. A `;--8<--` line is an
 * escape and is kept literally without the semicolon.
 */
export function expandSnippets(lines: string[], context: ExtensionContext, depth = 0): string[] {
  const output: string[] = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    const escaped = /^(\s*);(--8<--.*)$/.exec(line);
    if (escaped) {
      output.push(escaped[1]! + escaped[2]!);
      continue;
    }
    const single = /^(\s*)--8<--\s+["']([^"']+)["']\s*$/.exec(line);
    if (single) {
      output.push(...readSnippet(single[2]!, context, depth).map((included) => single[1] + included));
      continue;
    }
    if (/^\s*--8<--\s*$/.test(line)) {
      const indent = /^\s*/.exec(line)![0];
      index++;
      while (index < lines.length && !/^\s*--8<--\s*$/.test(lines[index]!)) {
        const reference = lines[index]!.trim();
        if (reference && !reference.startsWith(";")) {
          output.push(...readSnippet(reference, context, depth).map((included) => indent + included));
        }
        index++;
      }
      continue;
    }
    output.push(line);
  }
  return output;
}
