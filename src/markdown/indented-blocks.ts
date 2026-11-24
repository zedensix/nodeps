/**
 * Measures a line's leading whitespace in columns, counting a tab as four.
 */
export function indentOf(line: string) {
  return /^[ \t]*/.exec(line)![0].replace(/\t/g, "    ").length;
}

/**
 * Removes up to `amount` columns of leading whitespace, stopping early at the
 * first non-blank character so content is never cut.
 */
function dedent(line: string, amount: number) {
  let removed = 0;
  let index = 0;
  while (index < line.length && removed < amount && (line[index] === " " || line[index] === "\t")) {
    removed += line[index] === "\t" ? 4 : 1;
    index++;
  }
  return line.slice(index);
}

/**
 * Collects the body of a block (admonition, tab, footnote): the lines from
 * `start` indented by at least `indent`, dedented. Blank lines are kept
 * inside the body but trailing ones are handed back via `next`.
 */
export function collectIndented(lines: string[], start: number, indent: number) {
  const body: string[] = [];
  let index = start;
  while (index < lines.length) {
    const line = lines[index]!;
    if (line.trim() !== "" && indentOf(line) < indent) {
      break;
    }
    body.push(line.trim() === "" ? "" : dedent(line, indent));
    index++;
  }
  while (body.length > 0 && body.at(-1) === "") {
    body.pop();
    index--;
  }
  return { body, next: index };
}
