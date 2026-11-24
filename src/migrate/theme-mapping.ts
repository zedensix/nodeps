import { join } from "node:path";
import type { MigrationReport } from "./migrate.ts";
import { materialColors } from "./mkdocs-support.ts";

type Mapping = Record<string, unknown>;

export const generatedStylesheet = "extra.css";

/**
 * Turns a Material color name ("Deep Purple", "deep-purple") into its hex
 * value, or undefined for `custom` and names Material does not have.
 */
function materialColor(name: unknown) {
  return typeof name === "string" ? materialColors[name.toLowerCase().replace(/\s+/g, "-")] : undefined;
}

/**
 * Maps `theme.palette`: the light scheme's named primary becomes the accent,
 * a different dark one `theme.dark.accent`, and `accent` stands in when
 * primary is not a named color. Custom colors, unknown names and scheme
 * toggles are reported with what nodeps does instead.
 */
function mapPalette(palette: unknown, themeConfig: Mapping, report: MigrationReport) {
  const entries = (Array.isArray(palette) ? palette : palette ? [palette] : []) as Mapping[];
  if (entries.length === 0) {
    return;
  }
  const colored = entries.filter((entry) => entry.primary !== undefined || entry.accent !== undefined);
  const light =
    colored.find((entry) => entry.scheme !== "slate") ??
    entries.find((entry) => entry.scheme !== "slate") ??
    entries[0]!;
  const dark = entries.find((entry) => entry.scheme === "slate");
  const reported = new Set<string>();
  for (const entry of entries) {
    for (const key of ["primary", "accent"]) {
      const value = entry[key];
      if (value === undefined || materialColor(value) || reported.has(`${key}:${String(value)}`)) {
        continue;
      }
      reported.add(`${key}:${String(value)}`);
      report.warnings.push(
        value === "custom"
          ? `theme.palette.${key}: custom means the color lives in your CSS (--md-${key}-fg-color). nodeps does not read it: set theme.accent in docs.yaml to that color.`
          : `theme.palette.${key}: "${String(value)}" is not a Material color name, so it was not mapped. Set theme.accent in docs.yaml to the CSS color you want.`,
      );
    }
  }
  const primary = materialColor(light.primary);
  const accent = materialColor(light.accent);
  if (primary) {
    themeConfig.accent = primary;
    report.mapped.push(`theme.palette.primary (${String(light.primary)}) → theme.accent`);
    if (accent) {
      report.warnings.push(
        `theme.palette.accent (${String(light.accent)}) was not used: nodeps has one brand color and took primary. Swap theme.accent in docs.yaml if you prefer the accent.`,
      );
    }
  } else if (accent) {
    themeConfig.accent = accent;
    report.mapped.push(
      `theme.palette.accent (${String(light.accent)}) → theme.accent, as primary is not a named color`,
    );
  }
  const darkPrimary = materialColor(dark?.primary);
  if (dark && darkPrimary && darkPrimary !== themeConfig.accent) {
    themeConfig.dark = { accent: darkPrimary };
    report.mapped.push(`theme.palette (slate) primary (${String(dark.primary)}) → theme.dark.accent`);
  }
  if (entries.length > 1 || entries.some((entry) => entry.toggle || entry.media)) {
    report.native.push(
      "theme.palette: scheme toggles → nodeps follows the reader's device and has its own light, dark and device toggle in the header; readers can also pick another theme from the palette menu",
    );
  } else if (light.scheme === "slate") {
    report.warnings.push(
      "theme.palette.scheme: slate cannot be forced: nodeps follows the reader's device. Readers switch to dark with the header toggle.",
    );
  }
}

/**
 * Pre-fills `theme.font` and `theme.mono` with Material's font families plus
 * system fallbacks. nodeps never downloads fonts, so the report says how to
 * make them available.
 */
function mapFonts(font: unknown, themeConfig: Mapping, report: MigrationReport) {
  if (font === false) {
    report.native.push(
      "theme.font: false → nodeps uses its own font stack (Inter, then system fonts); set theme.font in docs.yaml to change it",
    );
    return;
  }
  if (typeof font !== "object" || font === null) {
    return;
  }
  const { text, code } = font as Mapping;
  const families: string[] = [];
  if (typeof text === "string") {
    themeConfig.font = `"${text}", ui-sans-serif, system-ui, sans-serif`;
    families.push(text);
    report.mapped.push(`theme.font.text (${text}) → theme.font`);
  }
  if (typeof code === "string") {
    themeConfig.mono = `"${code}", ui-monospace, monospace`;
    families.push(code);
    report.mapped.push(`theme.font.code (${code}) → theme.mono`);
  }
  if (families.length > 0) {
    report.warnings.push(
      `theme.font: Material downloaded ${families.join(" and ")} from Google Fonts; nodeps never downloads fonts. Readers without them installed see the system fallback: self-host them with @font-face in theme.stylesheet, or remove the family from theme.font and theme.mono.`,
    );
  }
}

/**
 * Keeps every `extra_css` file in order: one file is used directly, several
 * get a generated stylesheet next to docs.yaml that imports them in the same
 * order, so the cascade is unchanged. Remote URLs are reported instead.
 */
function mapStylesheets(extraCss: unknown, source: string, themeConfig: Mapping, report: MigrationReport) {
  const entries = Array.isArray(extraCss) ? extraCss.filter((entry): entry is string => typeof entry === "string") : [];
  const remote = entries.filter((entry) => /^[a-z][a-z\d+.-]*:/i.test(entry));
  const local = entries.filter((entry) => !remote.includes(entry));
  for (const url of remote) {
    report.warnings.push(
      `extra_css: ${url} is remote and was not added. Load it from a theme instead: add <link rel="stylesheet" href="${url}"> to themes/default/head.html.`,
    );
  }
  if (local.length === 1) {
    themeConfig.stylesheet = join(source, local[0]!);
    report.mapped.push(`extra_css (${local[0]}) → theme.stylesheet`);
  } else if (local.length > 1) {
    const imports = local.map((entry) => `@import "./${join(source, entry)}";`);
    report.files.push({ path: generatedStylesheet, content: `${imports.join("\n")}\n` });
    themeConfig.stylesheet = generatedStylesheet;
    report.mapped.push(
      `extra_css (${local.length} files) → theme.stylesheet: ${generatedStylesheet}, generated to import them in order`,
    );
  }
}

/**
 * Maps the theme-related settings of mkdocs.yml into `config.theme` and the
 * report: palette, fonts, extra stylesheets, plus explained refusals for
 * extra scripts and Jinja template overrides.
 */
export function mapTheme(mkdocs: Mapping, config: Mapping, report: MigrationReport) {
  const theme = (mkdocs.theme ?? {}) as Mapping;
  const themeConfig: Mapping = {};
  mapPalette(theme.palette, themeConfig, report);
  mapFonts(theme.font, themeConfig, report);
  mapStylesheets(mkdocs.extra_css, String(config.source ?? "docs"), themeConfig, report);
  if (Object.keys(themeConfig).length > 0) {
    config.theme = themeConfig;
  }
  const scripts = Array.isArray(mkdocs.extra_javascript) ? mkdocs.extra_javascript : [];
  if (scripts.length > 0) {
    const listed = scripts
      .map((entry) => (typeof entry === "string" ? entry : String((entry as Mapping).path)))
      .join(", ");
    report.unsupported.push(
      `extra_javascript (${listed}): nodeps has no setting that loads extra scripts. Math and Mermaid are built in. For any other script, put it in themes/default/ and load it from themes/default/head.html with <script src="./name.js"></script>.`,
    );
  }
  if (theme.custom_dir !== undefined) {
    report.unsupported.push(
      `theme.custom_dir (${String(theme.custom_dir)}): Material's Jinja overrides do not apply. Recreate the changes as a nodeps theme: copy the partial you need from the default theme into themes/default/ and edit it.`,
    );
  }
}
