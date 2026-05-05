import { describe, expect, it } from "vitest";
import {
  buildTree,
  getAncestors,
  getDescendantIds,
  groupByParent,
  walkTree,
} from "./tree";

type N = { id: string; parentId: string | null; name: string };

const flat: N[] = [
  { id: "a", parentId: null, name: "A" },
  { id: "b", parentId: "a", name: "B" },
  { id: "c", parentId: "a", name: "C" },
  { id: "d", parentId: "b", name: "D" },
  { id: "e", parentId: null, name: "E" },
];

describe("buildTree", () => {
  it("agrupa hijos bajo cada padre y mantiene orden de roots", () => {
    const roots = buildTree(flat);
    expect(roots.map((r) => r.id)).toEqual(["a", "e"]);
    expect(roots[0]?.children.map((c) => c.id)).toEqual(["b", "c"]);
    expect(roots[0]?.children[0]?.children.map((c) => c.id)).toEqual(["d"]);
  });

  it("trata nodes con parentId inexistente como roots (huérfanos)", () => {
    const orphan: N[] = [{ id: "x", parentId: "ghost", name: "X" }];
    const roots = buildTree(orphan);
    expect(roots).toHaveLength(1);
    expect(roots[0]?.id).toBe("x");
  });

  it("devuelve array vacío si la lista está vacía", () => {
    expect(buildTree<N>([])).toEqual([]);
  });
});

describe("groupByParent", () => {
  it("indexa por parentId con null para roots", () => {
    const m = groupByParent(flat);
    expect(m.get(null)?.map((n) => n.id)).toEqual(["a", "e"]);
    expect(m.get("a")?.map((n) => n.id)).toEqual(["b", "c"]);
  });
});

describe("walkTree", () => {
  it("visita en pre-order con depth correcta", () => {
    const visits: Array<[string, number]> = [];
    walkTree(buildTree(flat), (node, depth) => {
      visits.push([node.id, depth]);
    });
    expect(visits).toEqual([
      ["a", 0],
      ["b", 1],
      ["d", 2],
      ["c", 1],
      ["e", 0],
    ]);
  });
});

describe("getAncestors", () => {
  it("devuelve cadena padre→root, sin incluir el propio nodo", () => {
    const anc = getAncestors(flat, "d");
    expect(anc.map((n) => n.id)).toEqual(["b", "a"]);
  });

  it("devuelve [] para roots", () => {
    expect(getAncestors(flat, "a")).toEqual([]);
  });

  it("no entra en loop infinito si hay un ciclo", () => {
    const cyclic: N[] = [
      { id: "x", parentId: "y", name: "X" },
      { id: "y", parentId: "x", name: "Y" },
    ];
    // El cap defensivo (safety = nodes.length + 1) garantiza terminación.
    // El resultado puede contener ciclo pero longitud finita acotada.
    const anc = getAncestors(cyclic, "x");
    expect(anc.length).toBeLessThanOrEqual(cyclic.length + 1);
  });
});

describe("getDescendantIds", () => {
  it("incluye el propio id y todos los descendientes", () => {
    const ids = getDescendantIds(flat, "a");
    expect(ids).toEqual(new Set(["a", "b", "c", "d"]));
  });

  it("solo el id si es leaf", () => {
    expect(getDescendantIds(flat, "d")).toEqual(new Set(["d"]));
  });
});
