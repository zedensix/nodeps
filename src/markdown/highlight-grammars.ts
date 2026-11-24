type Rule = readonly [tokenType: string, pattern: RegExp];

export const grammars = new Map<string, Rule[]>();

/**
 * Registers a grammar under each of its language names. Patterns are compiled
 * sticky so the tokenizer can only match them at the current position, and
 * rules are tried in order, so earlier rules win.
 */
function define(names: string[], rules: Rule[]) {
  const sticky = rules.map(
    ([tokenType, pattern]) => [tokenType, new RegExp(pattern.source, pattern.flags + "y")] as const,
  );
  for (const name of names) {
    grammars.set(name, sticky);
  }
}

/**
 * Builds a pattern matching any of the whitespace-separated words, whole words only.
 */
const words = (list: string, flags = "") => new RegExp(`\\b(?:${list.trim().split(/\s+/).join("|")})\\b`, flags);

const doubleQuoted = /"(?:\\.|[^"\\\n])*"/;
const singleQuoted = /'(?:\\.|[^'\\\n])*'/;
const slashComment = /\/\/.*|\/\*[\s\S]*?\*\//;
const hashComment = /(?<=^|\s)#.*/m;
const number = /-?\b(?:0[xob][\da-f_]+|\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?)n?\b/i;
const functionCall = /\b[a-zA-Z_$][\w$]*(?=\s*\()/;
const typeName = /\b[A-Z][\w$]*\b/;
const operator = /=>|[+\-*/%=!<>&|^~?:]+/;
const punctuation = /[{}[\]();,.]/;

define(["js", "javascript", "mjs", "cjs", "jsx", "ts", "typescript", "mts", "cts", "tsx"], [
  ["comment", slashComment],
  ["string", /`(?:\\[\s\S]|[^`\\])*`/],
  ["string", doubleQuoted],
  ["string", singleQuoted],
  [
    "keyword",
    words(`
    abstract as async await break case catch class const continue declare default delete do else enum export
    extends finally for from function get if implements import in instanceof interface keyof let namespace new
    of private protected public readonly return satisfies set static super switch this throw try type typeof
    var void while with yield`),
  ],
  ["constant", words("true false null undefined NaN Infinity")],
  ["type", words("string number boolean any unknown never object symbol bigint")],
  ["meta", /@[\w.]+/],
  ["function", functionCall],
  ["type", typeName],
  ["number", number],
  ["operator", operator],
  ["punctuation", punctuation],
]);

define(["json", "jsonc", "json5"], [
  ["comment", slashComment],
  ["property", /"(?:\\.|[^"\\\n])*"(?=\s*:)/],
  ["string", doubleQuoted],
  ["constant", words("true false null")],
  ["number", number],
  ["punctuation", /[{}[\],:]/],
]);

define(["sh", "bash", "shell", "zsh", "console", "terminal"], [
  ["comment", hashComment],
  ["meta", /^\s*\$(?= )/m],
  ["string", doubleQuoted],
  ["string", /'[^']*'/],
  ["variable", /\$\{[^}\n]*\}|\$[\w@#?*!]+/],
  [
    "keyword",
    words(
      "if then elif else fi for while until do done case esac in function return export local readonly declare unset source alias",
    ),
  ],
  ["variable", /\b\w+(?==)/],
  ["function", /(?<=^\s*(?:\$\s+)?|[|;&]\s*|\b(?:sudo|then|do|else|exec)\s+)[\w./-]+/m],
  ["attribute", /(?<=\s)--?[\w-]+/],
  ["number", number],
  ["operator", /&&|\|\||[|&;<>]/],
]);

define(["css", "scss", "less"], [
  ["comment", slashComment],
  ["string", doubleQuoted],
  ["string", singleQuoted],
  ["keyword", /@[\w-]+|!important/],
  ["variable", /--[\w-]+|\$[\w-]+/],
  ["property", /[\w-]+(?=\s*:[^;{}]*[;}])/],
  ["function", /[\w-]+(?=\()/],
  ["number", /#[\da-f]{3,8}\b/i],
  ["type", /[.#][a-z_-][\w-]*/i],
  ["keyword", /::?[a-z-]+/],
  ["number", /-?(?:\d*\.)?\d+(?:px|r?em|%|vh|vw|vmin|vmax|ch|ex|s|ms|deg|turn|fr|dpi)?\b/],
  ["punctuation", /[{}();,:]/],
]);

define(["html", "xml", "svg", "vue", "svelte"], [
  ["comment", /<!--[\s\S]*?-->/],
  ["meta", /<!doctype[^>]*>/i],
  ["tag", /<\/?[\w:-]+/],
  ["tag", /\/?>/],
  ["attribute", /[\w:@.-]+(?==)/],
  ["string", /"[^"]*"|'[^'\n]*'/],
  ["constant", /&[\w#]+;/],
]);

define(["toml"], [
  ["comment", /#.*/],
  ["type", /^\s*\[\[?[^\]\n]*\]\]?/m],
  ["property", /^\s*[\w."-]+(?=\s*=)/m],
  ["string", /"""[\s\S]*?"""|'''[\s\S]*?'''/],
  ["string", doubleQuoted],
  ["string", /'[^'\n]*'/],
  ["number", /\d{4}-\d{2}-\d{2}(?:[T ][\d:.]+(?:Z|[+-]\d{2}:\d{2})?)?/],
  ["constant", words("true false")],
  ["number", number],
  ["punctuation", /[[\]{},=]/],
]);

define(["yaml", "yml"], [
  ["comment", hashComment],
  ["meta", /^(?:---|\.\.\.)\s*$/m],
  ["property", /(?<=^[ \t]*(?:-[ \t]+)?)[\w"'./-][^:\n]*?(?=:(?:\s|$))/m],
  ["string", doubleQuoted],
  ["string", /'[^'\n]*'/],
  ["variable", /[&*][\w-]+/],
  ["constant", words("true false null yes no on off")],
  ["number", number],
  ["punctuation", /[:\-[\]{},|>]/],
]);

define(["py", "python"], [
  ["comment", /#.*/],
  ["string", /(?:\b[rbuf]{1,2})?(?:"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')/i],
  ["meta", /@[\w.]+/],
  [
    "keyword",
    words(`
    and as assert async await break case class continue def del elif else except finally for from global if
    import in is lambda match nonlocal not or pass raise return try while with yield`),
  ],
  ["constant", words("True False None self cls")],
  ["function", functionCall],
  ["type", typeName],
  ["number", number],
  ["operator", operator],
  ["punctuation", punctuation],
]);

define(["rs", "rust"], [
  ["comment", slashComment],
  ["meta", /#!?\[[^\]\n]*\]/],
  ["string", /b?"(?:\\.|[^"\\])*"/],
  ["string", /'(?:\\.|[^'\\\n])'/],
  ["type", /'[a-z_]\w*/],
  [
    "keyword",
    words(`
    as async await break const continue crate dyn else enum extern fn for if impl in let loop match mod move mut
    pub ref return self static struct super trait type unsafe use where while`),
  ],
  ["type", words("i8 i16 i32 i64 i128 isize u8 u16 u32 u64 u128 usize f32 f64 bool char str Self")],
  ["constant", words("true false")],
  ["function", /\b\w+!/],
  ["function", functionCall],
  ["type", typeName],
  ["number", number],
  ["operator", operator],
  ["punctuation", punctuation],
]);

define(["go", "golang"], [
  ["comment", slashComment],
  ["string", /`[^`]*`/],
  ["string", doubleQuoted],
  ["string", /'(?:\\.|[^'\\\n])+'/],
  [
    "keyword",
    words(`
    break case chan const continue default defer else fallthrough for func go goto if import interface map
    package range return select struct switch type var`),
  ],
  [
    "type",
    words(
      "any bool byte complex64 complex128 error float32 float64 int int8 int16 int32 int64 rune string uint uint8 uint16 uint32 uint64 uintptr",
    ),
  ],
  ["constant", words("true false nil iota")],
  ["function", functionCall],
  ["type", typeName],
  ["number", number],
  ["operator", /:=|[+\-*/%=!<>&|^]+/],
  ["punctuation", punctuation],
]);

define(["sql"], [
  ["comment", /--.*|\/\*[\s\S]*?\*\//],
  ["string", /'(?:''|[^'])*'/],
  [
    "keyword",
    words(
      `
    select from where and or not insert into values update set delete create table index view drop alter add
    column primary key foreign references join left right inner outer full on as group by order having limit
    offset distinct union all case when then else end is null like in between exists returning with default
    unique constraint asc desc`,
      "i",
    ),
  ],
  ["function", functionCall],
  ["number", number],
  ["operator", /[=<>!|]+|[+\-*/%]/],
  ["punctuation", /[();,.]/],
]);

define(["diff", "patch"], [
  ["meta", /^(?:diff |index |--- |\+\+\+ ).*/m],
  ["meta", /^@@.*/m],
  ["inserted", /^\+.*/m],
  ["deleted", /^-.*/m],
]);

define(["dockerfile", "docker"], [
  ["comment", /^\s*#.*/m],
  [
    "keyword",
    /^\s*(?:FROM|RUN|CMD|LABEL|EXPOSE|ENV|ADD|COPY|ENTRYPOINT|VOLUME|USER|WORKDIR|ARG|ONBUILD|STOPSIGNAL|HEALTHCHECK|SHELL)\b/im,
  ],
  ["keyword", /\bAS\b/],
  ["string", doubleQuoted],
  ["string", singleQuoted],
  ["variable", /\$\{[^}\n]*\}|\$\w+/],
  ["attribute", /--[\w-]+/],
  ["punctuation", /[[\],]/],
]);

define(["nginx"], [
  ["comment", /#.*/],
  ["string", doubleQuoted],
  ["string", singleQuoted],
  ["variable", /\$\w+/],
  ["keyword", /(?<=^\s*|[{;]\s*)[a-z_]+/m],
  ["number", /\b\d+[kmsdh]?\b/i],
  ["punctuation", /[{};]/],
]);
