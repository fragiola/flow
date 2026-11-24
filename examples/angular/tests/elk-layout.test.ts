// @vitest-environment node
import ELK from "elkjs/lib/elk.bundled.js";
import { describe, expect, it } from "vitest";
import {
    type Algorithm,
    fromElkGraph,
    LAYOUT_OPTIONS,
    type LayoutEdge,
    type LayoutNode,
    layoutGraph,
    portId,
    toElkGraph,
} from "../src/examples/elk-layout/layout";

// The elk-layout example's adapter, against the real ELK (its bundled build runs in node): the
// graph it builds (ports per handle on their side, unique port ids, edges between ports), and
// what comes back (a place for every node, no overlap, layered edges going right, the handle
// order following the ports' y), for both algorithms.

const box = (
    id: string,
    inputs: string[],
    outputs: string[],
    width = 160,
    height = 76,
): LayoutNode => ({ id, width, height, inputs, outputs });

// a crossing on purpose: "b" is fed by "top" into its lower input and by "bottom" into its upper
const nodes: LayoutNode[] = [
    box("top", [], ["out"], 120, 40),
    box("bottom", [], ["out"], 120, 40),
    box("b", ["low", "high"], ["x", "y"]),
    box("c", ["in"], ["out"]),
    box("d", ["first", "second"], []),
];

const edges: LayoutEdge[] = [
    {
        id: "top-b",
        source: "top",
        sourceHandle: "out",
        target: "b",
        targetHandle: "high",
    },
    {
        id: "bottom-b",
        source: "bottom",
        sourceHandle: "out",
        target: "b",
        targetHandle: "low",
    },
    {
        id: "b-c",
        source: "b",
        sourceHandle: "y",
        target: "c",
        targetHandle: "in",
    },
    {
        id: "b-d",
        source: "b",
        sourceHandle: "x",
        target: "d",
        targetHandle: "second",
    },
    {
        id: "c-d",
        source: "c",
        sourceHandle: "out",
        target: "d",
        targetHandle: "first",
    },
];

const sizeOf = (id: string) => {
    const found = nodes.find((node) => node.id === id);
    if (!found) throw new Error(`no node ${id}`);
    return found;
};

describe("toElkGraph", () => {
    const graph = toElkGraph(nodes, edges, "layered");

    it("gives every node its size, FIXED_SIDE ports and one port per handle", () => {
        expect(graph.children?.map((child) => child.id)).toEqual(
            nodes.map((node) => node.id),
        );
        const b = graph.children?.find((child) => child.id === "b");
        expect(b).toMatchObject({ width: 160, height: 76 });
        expect(b?.layoutOptions).toEqual({
            "elk.portConstraints": "FIXED_SIDE",
        });
        expect(
            b?.ports?.map((port) => [
                port.id,
                port.layoutOptions?.["elk.port.side"],
            ]),
        ).toEqual([
            ["b:in:low", "WEST"],
            ["b:in:high", "WEST"],
            ["b:out:x", "EAST"],
            ["b:out:y", "EAST"],
        ]);
    });

    it("keeps the port ids unique across the graph, inputs and outputs apart", () => {
        const ids = (graph.children ?? []).flatMap((child) =>
            (child.ports ?? []).map((port) => port.id),
        );
        expect(new Set(ids).size).toBe(ids.length);
        expect(portId("c", "in", "x")).not.toBe(portId("c", "out", "x"));
    });

    it("joins each edge's source port to its target port", () => {
        const ports = new Set(
            (graph.children ?? []).flatMap((child) =>
                (child.ports ?? []).map((port) => port.id),
            ),
        );
        for (const edge of graph.edges ?? []) {
            for (const end of [...edge.sources, ...edge.targets]) {
                expect(ports.has(end), end).toBe(true);
            }
        }
        expect(graph.edges?.find((edge) => edge.id === "top-b")).toMatchObject({
            sources: ["top:out:out"],
            targets: ["b:in:high"],
        });
    });

    it("joins the node itself when an edge names no handle", () => {
        const plain = toElkGraph(
            nodes,
            [{ id: "e", source: "c", target: "d" }],
            "layered",
        );
        expect(plain.edges?.[0]).toMatchObject({
            sources: ["c"],
            targets: ["d"],
        });
    });

    it("asks for the algorithm, growing to the right", () => {
        expect(toElkGraph(nodes, edges, "mrtree").layoutOptions).toBe(
            LAYOUT_OPTIONS.mrtree,
        );
        for (const options of Object.values(LAYOUT_OPTIONS)) {
            expect(options["elk.direction"]).toBe("RIGHT");
        }
        expect(LAYOUT_OPTIONS.layered["elk.algorithm"]).toBe("layered");
        expect(LAYOUT_OPTIONS.mrtree["elk.algorithm"]).toBe("mrtree");
    });
});

describe("layoutGraph", () => {
    const algorithms: Algorithm[] = ["layered", "mrtree"];

    it("places every node, with either algorithm", async () => {
        for (const algorithm of algorithms) {
            const placements = await layoutGraph(nodes, edges, algorithm);
            expect([...placements.keys()].sort(), algorithm).toEqual(
                nodes.map((node) => node.id).sort(),
            );
        }
    });

    it("overlaps no two nodes", async () => {
        for (const algorithm of algorithms) {
            const placements = await layoutGraph(nodes, edges, algorithm);
            const rects = nodes.map((node) => ({
                ...node,
                ...placements.get(node.id)?.position,
            })) as (LayoutNode & { x: number; y: number })[];
            for (const [index, a] of rects.entries()) {
                for (const b of rects.slice(index + 1)) {
                    const apart =
                        a.x + a.width <= b.x ||
                        b.x + b.width <= a.x ||
                        a.y + a.height <= b.y ||
                        b.y + b.height <= a.y;
                    expect(apart, `${a.id} and ${b.id} (${algorithm})`).toBe(
                        true,
                    );
                }
            }
        }
    });

    it("puts every edge's target to the right of its source, layered", async () => {
        const placements = await layoutGraph(nodes, edges, "layered");
        for (const { source, target } of edges) {
            const from = placements.get(source)?.position.x ?? 0;
            const to = placements.get(target)?.position.x ?? 0;
            expect(to, `${target} right of ${source}`).toBeGreaterThan(
                from + sizeOf(source).width,
            );
        }
    });

    it("reorders the handles as ELK ordered the ports: the crossing undone", async () => {
        const placements = await layoutGraph(nodes, edges, "layered");
        const top = placements.get("top")?.position.y ?? 0;
        const bottom = placements.get("bottom")?.position.y ?? 0;
        const b = placements.get("b");
        // the input fed from the higher source comes first
        expect(b?.inputs).toEqual(
            top < bottom ? ["high", "low"] : ["low", "high"],
        );
        // the same handles, only in another order
        expect([...(b?.outputs ?? [])].sort()).toEqual(["x", "y"]);
    });
});

describe("fromElkGraph", () => {
    it("orders each side's handles by their ports' y and keeps ELK's top-left corner", async () => {
        const laid = await new ELK().layout(
            toElkGraph(nodes, edges, "layered"),
        );
        const placements = fromElkGraph(laid, nodes);
        for (const child of laid.children ?? []) {
            const placement = placements.get(child.id);
            expect(placement?.position).toEqual({ x: child.x, y: child.y });
            for (const [kind, handles] of [
                ["in", placement?.inputs ?? []],
                ["out", placement?.outputs ?? []],
            ] as const) {
                const ys = handles.map(
                    (handle) =>
                        child.ports?.find(
                            (port) =>
                                port.id === portId(child.id, kind, handle),
                        )?.y ?? Number.NaN,
                );
                expect(ys, `${child.id} ${kind}`).toEqual(
                    [...ys].sort((a, b) => a - b),
                );
            }
        }
    });

    it("keeps the document's order where the ports share a y, and skips a missing node", () => {
        const placements = fromElkGraph(
            {
                id: "root",
                children: [
                    {
                        id: "d",
                        x: 5,
                        y: 6,
                        ports: [
                            { id: "d:in:first", y: 10 },
                            { id: "d:in:second", y: 10 },
                        ],
                    },
                ],
            },
            nodes,
        );
        expect(placements.get("d")).toEqual({
            position: { x: 5, y: 6 },
            inputs: ["first", "second"],
            outputs: [],
        });
        expect(placements.has("b")).toBe(false);
    });
});
