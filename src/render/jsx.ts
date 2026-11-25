import { icon } from "../icons/icons.ts";

/**
 * HTML that is already safe to insert as is: rendered elements, and strings
 * wrapped with `raw()`. Its `toString()` returns the HTML, so it also works in
 * template literals and joins.
 */
export class Html {
  /**
   * Wraps HTML text that needs no escaping.
   */
  constructor(readonly value: string) {}

  /**
   * Returns the HTML text.
   */
  toString() {
    return this.value;
  }
}

export type Child = Html | string | number | boolean | null | undefined | Child[];

const voidElements = new Set(["area", "br", "col", "hr", "img", "input", "link", "meta", "source", "wbr"]);

/**
 * Marks a string as HTML to insert unescaped, such as an icon's SVG or code
 * the highlighter already escaped.
 */
export function raw(html: string) {
  return new Html(html);
}

/**
 * Renders children to HTML: text is escaped, `Html` kept as is, arrays
 * flattened, and null, undefined and booleans dropped so `{flag && <a />}`
 * works.
 */
function render(child: Child): string {
  if (child instanceof Html) {
    return child.value;
  }
  if (Array.isArray(child)) {
    return child.map(render).join("");
  }
  if (child === null || child === undefined || typeof child === "boolean") {
    return "";
  }
  return Bun.escapeHTML(String(child));
}

/**
 * The JSX factory: renders an element to an `Html` string, escaping attribute
 * values. `true` renders a bare attribute, `false`, null and undefined leave
 * it out. A function tag is a component called with its props and children.
 */
export function h(
  tag: string | ((props: Record<string, unknown> & { children: Child[] }) => Html),
  props: Record<string, unknown> | null,
  ...children: Child[]
): Html {
  if (typeof tag === "function") {
    return tag({ ...props, children });
  }
  let attributes = "";
  for (const [name, value] of Object.entries(props ?? {})) {
    if (value === true) {
      attributes += ` ${name}`;
    } else if (value !== false && value !== null && value !== undefined) {
      attributes += ` ${name}="${Bun.escapeHTML(String(value))}"`;
    }
  }
  return new Html(`<${tag}${attributes}>${voidElements.has(tag) ? "" : `${render(children)}</${tag}>`}`);
}

/**
 * The JSX fragment: its children, rendered with nothing around them.
 */
export function Fragment(props: { children?: Child }) {
  return new Html(render(props.children));
}

declare global {
  namespace JSX {
    type Element = Html;
    interface IntrinsicElements {
      [tag: string]: Record<string, unknown>;
    }
    interface ElementChildrenAttribute {
      children: unknown;
    }
  }
}

/**
 * Renders a named icon as inline SVG.
 */
export function Icon(props: { name: string }) {
  return new Html(icon(props.name));
}
