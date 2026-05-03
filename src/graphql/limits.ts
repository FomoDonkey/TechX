/**
 * Limits anti-abuse para GraphQL: depth + complexity.
 *
 * - Depth: profundidad máxima de selección (default 8).
 * - Complexity: cost analysis muy simple — cada field cuesta 1, list queries cuestan
 *   (limit args || 25) × cost de su selección. Total máximo 1000.
 *
 * Implementado como visitor en lugar de plugin para no depender de envelop.
 */

import {
  type DocumentNode,
  type FieldNode,
  GraphQLError,
  type OperationDefinitionNode,
  visit,
} from "graphql";

export const DEFAULT_MAX_DEPTH = 8;
export const DEFAULT_MAX_COMPLEXITY = 1000;

export function checkDepth(doc: DocumentNode, max = DEFAULT_MAX_DEPTH): number {
  let maxFound = 0;
  for (const def of doc.definitions) {
    if (def.kind !== "OperationDefinition") continue;
    const op = def as OperationDefinitionNode;
    const d = walk(op.selectionSet, 0, max);
    if (d > maxFound) maxFound = d;
  }
  if (maxFound > max) {
    throw new GraphQLError(`Query depth ${maxFound} exceeds maximum ${max}`, {
      extensions: { code: "DEPTH_LIMIT" },
    });
  }
  return maxFound;
}

function walk(
  selection: { selections: ReadonlyArray<unknown> } | null | undefined,
  depth: number,
  max: number,
): number {
  if (!selection || depth > max) return depth;
  let m = depth;
  for (const sel of selection.selections) {
    // biome-ignore lint/suspicious/noExplicitAny: AST node union
    const s = sel as any;
    if (s.kind === "Field" && s.selectionSet) {
      const d = walk(s.selectionSet, depth + 1, max);
      if (d > m) m = d;
    } else if ((s.kind === "InlineFragment" || s.kind === "FragmentSpread") && s.selectionSet) {
      const d = walk(s.selectionSet, depth, max);
      if (d > m) m = d;
    }
  }
  return m;
}

const LIST_FIELD_PATTERNS = [
  /^entries$/,
  /^media$/,
  /^pages$/,
  /^comments$/,
  /^submissions$/,
  /^automationRuns$/,
  /^webhooks$/,
  /^menus$/,
  /^redirects$/,
  /^forms$/,
  /^automations$/,
  /^collections$/,
  /^taxonomies$/,
];

const DEFAULT_LIST_SIZE = 25;
const MAX_LIST_SIZE = 100;

export function checkComplexity(
  doc: DocumentNode,
  variables: Record<string, unknown>,
  max = DEFAULT_MAX_COMPLEXITY,
): number {
  let total = 0;
  visit(doc, {
    Field(node: FieldNode) {
      const name = node.name.value;
      const isList = LIST_FIELD_PATTERNS.some((re) => re.test(name));
      let cost = 1;
      if (isList) {
        const limitArg = node.arguments?.find((a) => a.name.value === "limit");
        let limit = DEFAULT_LIST_SIZE;
        if (limitArg) {
          if (limitArg.value.kind === "IntValue") {
            limit = Number(limitArg.value.value);
          } else if (limitArg.value.kind === "Variable") {
            const v = variables[limitArg.value.name.value];
            if (typeof v === "number") limit = v;
          }
        }
        limit = Math.min(Math.max(1, limit), MAX_LIST_SIZE);
        cost = limit;
      }
      total += cost;
    },
  });
  if (total > max) {
    throw new GraphQLError(`Query complexity ${total} exceeds maximum ${max}`, {
      extensions: { code: "COMPLEXITY_LIMIT", complexity: total, max },
    });
  }
  return total;
}
