import { expect, test } from "bun:test";
import { highlight } from "./highlight.ts";

test("svelte uses the HTML grammar: tags and attributes, not the script inside", () => {
  const [line] = highlight("<button on:click={() => count++}>{count}</button>", "svelte");
  expect(line).toContain('<span class="token tag">');
  expect(line).toContain('<span class="token attribute">');
});

test("an unknown language renders as escaped plain text", () => {
  expect(highlight("a < b\nc", "cobol-2077")).toEqual(["a &lt; b", "c"]);
});
