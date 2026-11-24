export interface Attributes {
  id?: string;
  classes: string[];
  values: Record<string, string>;
}

/**
 * Parses the inside of an attr_list `{...}`: `.name` adds a class, `#name`
 * sets the id, `key=value` (quoted or bare) sets any other attribute.
 */
export function parseAttributes(text: string): Attributes {
  const attributes: Attributes = { classes: [], values: {} };
  for (const match of text.matchAll(/([.#])([\w-]+)|([\w-]+)=(?:"([^"]*)"|'([^']*)'|(\S+))/g)) {
    if (match[1] === ".") {
      attributes.classes.push(match[2]!);
    } else if (match[1] === "#") {
      attributes.id = match[2];
    } else if (match[3]) {
      attributes.values[match[3]] = match[4] ?? match[5] ?? match[6] ?? "";
    }
  }
  return attributes;
}

/**
 * Merges parsed attributes into an HTML opening tag: classes are appended to
 * an existing `class`, the id replaces an existing one, other values are
 * inserted right after the tag name.
 */
export function applyAttributes(tag: string, attributes: Attributes) {
  let result = tag;
  if (attributes.classes.length > 0) {
    const classes = attributes.classes.join(" ");
    result = /\sclass="/.test(result)
      ? result.replace(/\sclass="([^"]*)"/, ` class="$1 ${classes}"`)
      : result.replace(/^<(\w+)/, `<$1 class="${classes}"`);
  }
  if (attributes.id) {
    result = /\sid="/.test(result)
      ? result.replace(/\sid="[^"]*"/, ` id="${Bun.escapeHTML(attributes.id)}"`)
      : result.replace(/^<(\w+)/, `<$1 id="${Bun.escapeHTML(attributes.id)}"`);
  }
  for (const [name, value] of Object.entries(attributes.values)) {
    result = result.replace(/^<(\w+)/, `<$1 ${name}="${Bun.escapeHTML(value)}"`);
  }
  return result;
}
