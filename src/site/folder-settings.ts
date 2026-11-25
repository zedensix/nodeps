import { icon, normalizeIcon } from "../icons/icons.ts";

export const diataxisKinds = ["tutorials", "how-to", "reference", "explanation"] as const;
export type DiataxisKind = (typeof diataxisKinds)[number];

export interface FolderSettings {
  title?: string;
  icon?: string;
  order?: number;
  description?: string;
  diataxis?: DiataxisKind;
  dropdown?: boolean;
}

export const folderFile = "_folder.yaml";

const diataxisAliases: Record<string, DiataxisKind> = { howto: "how-to", tutorial: "tutorials" };

/**
 * Reads a Diataxis kind, accepting `howto` and `tutorial` as aliases and any
 * letter case. Undefined for anything else.
 */
export function diataxisKind(value: unknown): DiataxisKind | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const kind = diataxisAliases[value.toLowerCase()] ?? value.toLowerCase();
  return diataxisKinds.includes(kind as DiataxisKind) ? (kind as DiataxisKind) : undefined;
}

/**
 * Reads and validates a `_folder.yaml` file. Any bad key throws with the file
 * path in the message, so a typo stops the build instead of being ignored.
 */
export async function readFolderSettings(path: string): Promise<FolderSettings> {
  let data: Record<string, unknown>;
  try {
    data = (Bun.YAML.parse(await Bun.file(path).text()) ?? {}) as Record<string, unknown>;
  } catch (error) {
    throw new Error(`${path}: invalid YAML: ${(error as Error).message}`, { cause: error });
  }
  const settings: FolderSettings = {};
  if (data.title !== undefined) {
    if (typeof data.title !== "string") {
      throw new Error(`${path}: "title" must be a string`);
    }
    settings.title = data.title;
  }
  if (data.icon !== undefined) {
    if (typeof data.icon !== "string") {
      throw new Error(`${path}: "icon" must be a Lucide icon name`);
    }
    try {
      icon(normalizeIcon(data.icon));
    } catch {
      throw new Error(`${path}: unknown icon "${data.icon}", see https://lucide.dev/icons`);
    }
    settings.icon = normalizeIcon(data.icon);
  }
  if (data.order !== undefined) {
    if (typeof data.order !== "number") {
      throw new Error(`${path}: "order" must be a number`);
    }
    settings.order = data.order;
  }
  if (data.dropdown !== undefined) {
    if (typeof data.dropdown !== "boolean") {
      throw new Error(`${path}: "dropdown" must be true or false`);
    }
    settings.dropdown = data.dropdown;
  }
  if (data.description !== undefined) {
    if (typeof data.description !== "string") {
      throw new Error(`${path}: "description" must be a string`);
    }
    settings.description = data.description;
  }
  if (data.diataxis !== undefined) {
    settings.diataxis = diataxisKind(data.diataxis);
    if (!settings.diataxis) {
      throw new Error(`${path}: "diataxis" must be one of ${diataxisKinds.join(", ")}`);
    }
  }
  return settings;
}
