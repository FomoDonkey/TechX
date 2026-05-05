/**
 * Helpers genéricos para árboles jerárquicos basados en `parentId`.
 *
 * **Por qué en JS y no CTE recursivo:** los árboles del CSM (mediaFolders,
 * comment threads, terms taxonómicos, menús) son pequeños (decenas de nodes
 * en el peor caso). Un SELECT plano del workspace + transformación en JS
 * cuesta menos que el overhead de un `WITH RECURSIVE` y se comporta idéntico
 * en Postgres y MySQL 8+ sin tocar SQL.
 *
 * Si en el futuro algún feature requiere árboles grandes (>10K nodes) o
 * queries que filtren por descendencia ("dame todos los descendientes de X"),
 * usar CTE recursivo — sintaxis idéntica en Postgres y MySQL 8+:
 *
 *   WITH RECURSIVE tree AS (
 *     SELECT id, parent_id, 1 AS depth FROM table WHERE id = $1
 *     UNION ALL
 *     SELECT t.id, t.parent_id, tree.depth + 1
 *     FROM table t JOIN tree ON t.parent_id = tree.id
 *   )
 *   SELECT * FROM tree;
 *
 * MySQL 5.7 no soporta `WITH RECURSIVE` — el target del CSM es 8+.
 */

export type WithParent = { id: string; parentId: string | null };

export type TreeNode<T extends WithParent> = T & { children: TreeNode<T>[] };

/**
 * Construye un árbol desde una lista plana de nodes con `parentId`.
 * Nodos huérfanos (parentId apunta a id inexistente) se incluyen como roots.
 *
 * Complexity: O(n).
 */
export function buildTree<T extends WithParent>(nodes: readonly T[]): TreeNode<T>[] {
  const byId = new Map<string, TreeNode<T>>();
  for (const n of nodes) {
    byId.set(n.id, { ...n, children: [] });
  }
  const roots: TreeNode<T>[] = [];
  for (const n of byId.values()) {
    const parent = n.parentId ? byId.get(n.parentId) : undefined;
    if (parent) {
      parent.children.push(n);
    } else {
      roots.push(n);
    }
  }
  return roots;
}

/**
 * Variante "byParent" — devuelve un Map<parentId|null, T[]> sin construir
 * la estructura recursiva. Útil cuando el render hace lookups iterativos
 * (ej. UI con rendering on-demand de subniveles).
 */
export function groupByParent<T extends WithParent>(nodes: readonly T[]): Map<string | null, T[]> {
  const m = new Map<string | null, T[]>();
  for (const n of nodes) {
    const arr = m.get(n.parentId) ?? [];
    arr.push(n);
    m.set(n.parentId, arr);
  }
  return m;
}

/**
 * Recorrido pre-order (depth-first, padre antes que hijos).
 * Aplica `visit` con node + depth empezando en 0.
 */
export function walkTree<T extends WithParent>(
  roots: readonly TreeNode<T>[],
  visit: (node: TreeNode<T>, depth: number) => void,
  startDepth = 0,
): void {
  for (const r of roots) {
    visit(r, startDepth);
    walkTree(r.children, visit, startDepth + 1);
  }
}

/**
 * Devuelve la cadena de ancestors de `nodeId` (excluyendo el propio nodo)
 * desde el padre directo hasta el root. `[]` si el nodo no existe o es root.
 *
 * Útil para breadcrumbs y validación anti-ciclos en moves.
 */
export function getAncestors<T extends WithParent>(nodes: readonly T[], nodeId: string): T[] {
  const byId = new Map<string, T>();
  for (const n of nodes) byId.set(n.id, n);
  const out: T[] = [];
  let cur = byId.get(nodeId);
  if (!cur) return out;
  // Cap defensivo contra ciclos (el schema no debería permitirlos, pero
  // un INSERT manual mal hecho podría introducirlos).
  let safety = nodes.length + 1;
  while (cur?.parentId && safety-- > 0) {
    const parent = byId.get(cur.parentId);
    if (!parent) break;
    out.push(parent);
    cur = parent;
  }
  return out;
}

/**
 * Devuelve los IDs de descendientes (incluyendo `nodeId`).
 * Útil para borrado en cascada en JS cuando el FK no tiene `ON DELETE CASCADE`.
 */
export function getDescendantIds<T extends WithParent>(
  nodes: readonly T[],
  nodeId: string,
): Set<string> {
  const byParent = groupByParent(nodes);
  const result = new Set<string>([nodeId]);
  const queue = [nodeId];
  while (queue.length > 0) {
    const cur = queue.shift();
    if (cur === undefined) break;
    for (const child of byParent.get(cur) ?? []) {
      if (!result.has(child.id)) {
        result.add(child.id);
        queue.push(child.id);
      }
    }
  }
  return result;
}
