import { grammars } from "./highlight-grammars.ts";

const plainChunk = /[\w$]+|\s+|[^\w$\s]/y;

/**
 * Whether a fence language has a grammar, case-insensitively.
 */
export function isSupported(language: string) {
  return grammars.has(language.toLowerCase());
}

/**
 * Tokenizes code with the language's grammar and returns one HTML string per
 * source line, tokens wrapped in `token <type>` spans and everything escaped.
 * Tokens spanning lines are split so each line stays self-contained; an unknown
 * language yields the escaped lines with no spans.
 */
export function highlight(code: string, language: string): string[] {
  const rules = grammars.get(language.toLowerCase());
  const lines = [""];
  const emit = (tokenType: string | null, text: string) => {
    text.split("\n").forEach((part, index) => {
      if (index > 0) {
        lines.push("");
      }
      if (part) {
        lines[lines.length - 1] += tokenType
          ? `<span class="token ${tokenType}">${Bun.escapeHTML(part)}</span>`
          : Bun.escapeHTML(part);
      }
    });
  };
  if (!rules) {
    emit(null, code);
    return lines;
  }
  let position = 0;
  let plain = "";
  scan: while (position < code.length) {
    for (const [tokenType, pattern] of rules) {
      pattern.lastIndex = position;
      const match = pattern.exec(code);
      if (match && match[0].length > 0) {
        if (plain) {
          emit(null, plain);
        }
        plain = "";
        emit(tokenType, match[0]);
        position += match[0].length;
        continue scan;
      }
    }
    plainChunk.lastIndex = position;
    const chunk = plainChunk.exec(code)![0];
    plain += chunk;
    position += chunk.length;
  }
  if (plain) {
    emit(null, plain);
  }
  return lines;
}
