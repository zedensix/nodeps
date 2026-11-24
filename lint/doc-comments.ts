interface Comment {
  type: string;
  value: string;
  loc: { end: { line: number } };
}

interface Node {
  type: string;
  parent: Node;
  loc: { start: { line: number } };
}

interface Context {
  sourceCode: { getCommentsBefore(node: Node): Comment[] };
  report(descriptor: { node: Node; messageId: string }): void;
}

/**
 * Returns the node a doc comment sits above: the export statement when the
 * function is exported, the `const` statement for a function stored in one.
 */
function documentedNode(node: Node) {
  let target = node.type === "VariableDeclarator" ? node.parent : node;
  if (target.parent.type === "ExportNamedDeclaration" || target.parent.type === "ExportDefaultDeclaration") {
    target = target.parent;
  }
  return target;
}

/**
 * Reports a function or method unless a multiline `/** ... *\/` comment sits
 * right above it.
 */
function check(context: Context, node: Node) {
  const target = documentedNode(node);
  const comment = context.sourceCode.getCommentsBefore(target).at(-1);
  const adjacent = comment !== undefined && comment.loc.end.line >= target.loc.start.line - 1;
  if (!adjacent || comment.type !== "Block" || !comment.value.startsWith("*")) {
    context.report({ node: target, messageId: "missing" });
  } else if (!comment.value.includes("\n")) {
    context.report({ node: target, messageId: "singleLine" });
  }
}

export default {
  meta: { name: "nodeps" },
  rules: {
    "require-doc-comment": {
      meta: {
        type: "suggestion",
        docs: { description: "Every function and method has a multiline doc comment" },
        messages: {
          missing: "Add a multiline /** */ doc comment above this function.",
          singleLine: "Write this doc comment on several lines: /** on its own line, then the text, then */.",
        },
      },
      /**
       * Visits named functions: declarations, class and object methods, and
       * functions stored in a top-level `const`.
       */
      create(context: Context) {
        const visit = (node: Node) => check(context, node);
        return {
          FunctionDeclaration: visit,
          MethodDefinition: visit,
          "Property[method=true]": visit,
          "Property[kind=/^[gs]et$/]": visit,
          "Program > VariableDeclaration > VariableDeclarator[init.type=/Function/]": visit,
          "ExportNamedDeclaration > VariableDeclaration > VariableDeclarator[init.type=/Function/]": visit,
        };
      },
    },
  },
};
