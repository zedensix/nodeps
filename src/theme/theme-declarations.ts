import type { ThemeVariables } from "./themes.ts";

/**
 * Serializes a theme into a `;`-joined list of CSS custom properties:
 * `--brand` for the accent, tokens as is, and each color scheme's values
 * prefixed `--light-` or `--dark-`.
 */
export function themeDeclarations(theme: ThemeVariables) {
  const declarations = [`--brand:${theme.accent}`];
  for (const [name, value] of Object.entries(theme.tokens)) {
    declarations.push(`--${name}:${value}`);
  }
  for (const [name, value] of Object.entries(theme.light)) {
    declarations.push(`--light-${name}:${value}`);
  }
  for (const [name, value] of Object.entries(theme.dark)) {
    declarations.push(`--dark-${name}:${value}`);
  }
  return declarations.join(";");
}
