// What #39 adds to the Angular adapter: the first render (before the engine exists) draws the
// edges and places the nodes from the static geometry (`staticGeometry`, with the root's options),
// the render levels (`render-layers`) as one wrapper per level when an edge stands above some node
// (today's DOM with one), `zIndexMode` on the root, and `adapter.refocus` from `[flowEdge]`. Angular
// has no server render (a known limit): the first client render is the one before the engine. The
// engine is wrapped so a test sees the DOM the root rendered before creating it, and `refocus`.
import type { FlowEngine, FlowEngineOptions, FlowModel } from "@fragiola/flow";
import { selection } from "@fragiola/flow/selection";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    type AnyTypes,
    createFlowRef,
    type FlowEdge,
    type FlowFeatures,
    type FlowNode,
} from "../src/public-api";
import { TestFlow } from "./fixtures";
import { installLayout, part, render, settle, task } from "./flow";

interface FirstRender {
    /** each edge path's `d`, by edge id */
    paths: Record<string, string | null>;
    /** each node's structural transform and z-index, by node id */
    nodes: Record<string, { transform: string; zIndex: string }>;
    /** the levels' wrappers: their `data-level` and `z-index` */
    levels: { level: string | null; zIndex: string }[];
}

const engines = vi.hoisted(
    () =>
        [] as {
            options: FlowEngineOptions;
            first: FirstRender;
            refocus: ReturnType<typeof vi.fn>;
        }[],
);

/** What the document shows now: the edge paths, the nodes and the level wrappers. */
function snapshot(): FirstRender {
    const all = (selector: string) => [
        ...document.querySelectorAll<HTMLElement>(selector),
    ];
    return {
        paths: Object.fromEntries(
            all('[data-flow-part="edge-path"]').map((path) => [
                path.getAttribute("data-flow-id"),
                path.getAttribute("d"),
            ]),
        ),
        nodes: Object.fromEntries(
            all('[data-flow-part="node"]').map((node) => [
                node.getAttribute("data-flow-id"),
                { transform: node.style.transform, zIndex: node.style.zIndex },
            ]),
        ),
        levels: all('[data-flow-part="edges-layer"]').map((wrapper) => ({
            level: wrapper.getAttribute("data-level"),
            zIndex: wrapper.style.zIndex,
        })),
    };
}

vi.mock("@fragiola/flow", async (importOriginal) => {
    const core = await importOriginal<typeof import("@fragiola/flow")>();
    return {
        ...core,
        createFlowEngine(model: FlowModel, options: FlowEngineOptions) {
            // the root creates its engine after its first render: what it drew without one
            const first = snapshot();
            const engine = core.createFlowEngine(model, options) as FlowEngine;
            const refocus = vi.fn((element: Element) =>
                engine.adapter.refocus(element),
            );
            engines.push({ options, first, refocus });
            const adapter = Object.create(engine.adapter, {
                refocus: { value: refocus },
            });
            return Object.create(engine, { adapter: { value: adapter } });
        },
    };
});

beforeEach(() => {
    installLayout();
    engines.length = 0;
});

const last = () => {
    const engine = engines.at(-1);
    if (!engine) throw new Error("no engine");
    return engine;
};

/** A node whose handles are declared at the centre of its top and bottom sides (100 × 40). */
function declared(
    id: string,
    x: number,
    y: number,
    extra: Partial<FlowNode> = {},
): FlowNode {
    return task(id, x, y, {
        handles: [
            {
                type: "target",
                position: "top",
                x: 45,
                y: -5,
                width: 10,
                height: 10,
            },
            {
                type: "source",
                position: "bottom",
                x: 45,
                y: 35,
                width: 10,
                height: 10,
            },
        ],
        ...extra,
    } as Partial<FlowNode>);
}

const features = [selection()] as const;

const NODES = [
    declared("a", 0, 0),
    declared("b", 0, 200),
    declared("c", 200, 200),
];
const EDGES: FlowEdge[] = [
    { id: "ab", source: "a", target: "b" } as FlowEdge,
    { id: "ac", source: "a", target: "c" } as FlowEdge,
];

const edgesLayer = (container: HTMLElement) => part(container, "edges");
const wrappers = (container: HTMLElement) => [
    ...container.querySelectorAll<HTMLElement>(
        '[data-flow-part="edges-layer"]',
    ),
];

describe("the first render, before the engine (#39)", () => {
    it("draws the edges from the declared sizes and handles, the very paths the engine draws once it measured", async () => {
        const { container } = await render(TestFlow, {
            features,
            defaultNodes: NODES,
            defaultEdges: EDGES,
        });
        const { first } = last();
        expect(first.paths.ab).toMatch(/^M/);
        expect(first.paths.ac).toMatch(/^M/);
        await settle();
        const now = snapshot();
        expect(now.paths).toEqual(first.paths);
        expect(part(container, "edge-path", "ab").getAttribute("d")).toBe(
            first.paths.ab,
        );
        // the nodes stood at their place already, with the engine's z-index
        expect(now.nodes).toEqual(first.nodes);
        expect(first.nodes.b?.transform).toBe("translate(0px, 200px)");
    });

    it("draws no edge whose node has no known size", async () => {
        const unsized = {
            id: "u",
            type: "task",
            position: { x: 0, y: 300 },
            data: {},
        } as FlowNode;
        const { container } = await render(TestFlow, {
            features,
            defaultNodes: [declared("a", 0, 0), unsized],
            defaultEdges: [{ id: "au", source: "a", target: "u" } as FlowEdge],
        });
        expect(last().first.paths).toEqual({});
        expect(container.querySelector('[data-flow-part="edge"]')).toBeNull();
    });

    it("counts initialWidth and initialHeight until the node is measured", async () => {
        await render(TestFlow, {
            features,
            defaultNodes: [
                declared("a", 0, 0),
                {
                    id: "i",
                    type: "task",
                    position: { x: 0, y: 300 },
                    data: {},
                    initialWidth: 100,
                    initialHeight: 40,
                } as FlowNode,
            ],
            defaultEdges: [{ id: "ai", source: "a", target: "i" } as FlowEdge],
        });
        expect(last().first.paths.ai).toMatch(/^M/);
    });

    it("places a node by its own origin (and the root's nodeOrigin), before and after the engine", async () => {
        const { container } = await render(TestFlow, {
            features,
            nodeOrigin: { x: 1, y: 1 },
            defaultNodes: [
                declared("a", 100, 100, { origin: { x: 0.5, y: 0.5 } }),
                declared("b", 100, 100),
            ],
        });
        const { first } = last();
        expect(first.nodes.a?.transform).toBe("translate(50px, 80px)");
        expect(first.nodes.b?.transform).toBe("translate(0px, 60px)");
        await settle();
        expect(part(container, "node", "a").style.transform).toBe(
            "translate(50px, 80px)",
        );
        expect(part(container, "node", "b").style.transform).toBe(
            "translate(0px, 60px)",
        );
    });

    it("draws the levels already when an edge stands above a node (a selected edge in the auto mode)", async () => {
        await render(TestFlow, {
            features,
            defaultNodes: NODES,
            defaultEdges: [
                EDGES[0],
                { ...EDGES[1], selected: true },
            ] as FlowEdge[],
        });
        const { first } = last();
        expect(first.levels.map((level) => level.level)).toEqual(["0", "1"]);
        expect(first.levels.every((level) => level.zIndex !== "")).toBe(true);
        expect(first.paths.ac).toMatch(/^M/);
    });
});

describe("the render levels (#39)", () => {
    it("keeps today's DOM with one level: one SVG in the edges' element, labels there, the nodes isolated", async () => {
        const { container } = await render(TestFlow, {
            features,
            label: true,
            defaultNodes: NODES,
            defaultEdges: EDGES,
        });
        const edges = edgesLayer(container);
        expect(wrappers(container)).toHaveLength(0);
        const svgs = edges.querySelectorAll(
            ':scope > svg[data-flow-part="edges"]',
        );
        expect(svgs).toHaveLength(1);
        expect(
            svgs[0]?.querySelectorAll('[data-flow-part="edge"]'),
        ).toHaveLength(2);
        expect(part(container, "edge-label", "ab").parentElement).toBe(edges);
        expect(part(container, "nodes").style.isolation).toBe("isolate");
    });

    it("keeps one level in the basic mode, a selected edge raised among the edges only", async () => {
        const { container } = await render(TestFlow, {
            features,
            zIndexMode: "basic",
            elevateEdgesOnSelect: true,
            defaultNodes: NODES,
            defaultEdges: [
                EDGES[0],
                { ...EDGES[1], selected: true },
            ] as FlowEdge[],
        });
        expect(wrappers(container)).toHaveLength(0);
        expect(part(container, "nodes").style.isolation).toBe("isolate");
    });

    it("draws each level in a wrapper of its own, with its z-index, its SVG and its labels, the nodes interleaving", async () => {
        const flow = createFlowRef<AnyTypes, FlowFeatures>();
        const { container } = await render(TestFlow, {
            features,
            label: true,
            flowRef: flow,
            defaultNodes: NODES,
            defaultEdges: EDGES,
        });
        flow.current?.model.run("selection.set", { edgeIds: ["ac"] });
        await settle();
        const edges = edgesLayer(container);
        const levels = wrappers(container);
        expect(levels.map((level) => level.getAttribute("data-level"))).toEqual(
            ["0", "1"],
        );
        expect(levels.every((level) => level.parentElement === edges)).toBe(
            true,
        );
        const layers = flow.current?.engine.get("render-layers") ?? [];
        levels.forEach((level, i) => {
            expect(level.style.zIndex).toBe(String(layers[i]?.zIndex));
            expect(level.style.position).toBe("absolute");
            expect(level.style.pointerEvents).toBe("none");
            expect(level.style.width).toBe("100%");
        });
        const svgOf = (edgeId: string) =>
            part(container, "edge", edgeId).closest("svg");
        expect(svgOf("ab")?.parentElement).toBe(levels[0]);
        expect(svgOf("ac")?.parentElement).toBe(levels[1]);
        expect(svgOf("ac")).toHaveAttribute("data-flow-part", "edges");
        expect(part(container, "edge-label", "ab").parentElement).toBe(
            levels[0],
        );
        expect(part(container, "edge-label", "ac").parentElement).toBe(
            levels[1],
        );
        // the nodes stay in their layer, out of its own stacking context, at their level's z-index
        const nodes = part(container, "nodes");
        expect(nodes.style.isolation).toBe("");
        expect(part(container, "node", "a").parentElement).toBe(nodes);
        const zIndexOf = flow.current?.engine.get("node-z-index-by", {
            nodeId: "a",
        });
        expect(part(container, "node", "a").style.zIndex).toBe(
            String(zIndexOf),
        );

        // back to one level: today's DOM again
        flow.current?.model.run("selection.clear", {});
        await settle();
        expect(wrappers(container)).toHaveLength(0);
        expect(svgOf("ac")?.parentElement).toBe(edges);
        expect(svgOf("ab")).toBe(svgOf("ac"));
        expect(part(container, "edge-label", "ac").parentElement).toBe(edges);
        expect(nodes.style.isolation).toBe("isolate");
    });

    it("keeps an edge's view when it changes level (its element moves) and gives its focus back", async () => {
        const flow = createFlowRef<AnyTypes, FlowFeatures>();
        const { container } = await render(TestFlow, {
            features,
            flowRef: flow,
            defaultNodes: NODES,
            defaultEdges: EDGES,
        });
        const edge = part(container, "edge", "ac") as unknown as SVGGElement;
        edge.setAttribute("tabindex", "0");
        edge.focus();
        expect(document.activeElement).toBe(edge);
        flow.current?.model.run("selection.set", { edgeIds: ["ac"] });
        await settle();
        expect(part(container, "edge", "ac")).toBe(edge);
        expect(edge.closest('[data-flow-part="edges-layer"]')).toHaveAttribute(
            "data-level",
            "1",
        );
        expect(last().refocus).toHaveBeenCalledWith(edge);
        expect(document.activeElement).toBe(edge);
    });

    it("keeps the focus of a level-0 edge when the levels come and go (its SVG moves)", async () => {
        const flow = createFlowRef<AnyTypes, FlowFeatures>();
        const { container } = await render(TestFlow, {
            features,
            flowRef: flow,
            defaultNodes: NODES,
            defaultEdges: EDGES,
        });
        const edge = part(container, "edge", "ab") as unknown as SVGGElement;
        edge.setAttribute("tabindex", "0");
        edge.focus();
        expect(document.activeElement).toBe(edge);
        // another edge selected: two levels, level 0's SVG moves into its wrapper
        flow.current?.model.run("selection.set", { edgeIds: ["ac"] });
        await settle();
        expect(wrappers(container)).toHaveLength(2);
        expect(edge.closest('[data-flow-part="edges-layer"]')).toHaveAttribute(
            "data-level",
            "0",
        );
        expect(document.activeElement).toBe(edge);
        // unselected: one level again, the SVG back in the app's element
        flow.current?.model.run("selection.clear");
        await settle();
        expect(wrappers(container)).toHaveLength(0);
        expect(part(container, "edge", "ab")).toBe(edge);
        expect(document.activeElement).toBe(edge);
    });

    it("calls refocus with each edge's element once it is drawn", async () => {
        const { container } = await render(TestFlow, {
            features,
            defaultNodes: NODES,
            defaultEdges: EDGES,
        });
        expect(last().refocus).toHaveBeenCalledWith(
            part(container, "edge", "ab"),
        );
        expect(last().refocus).toHaveBeenCalledWith(
            part(container, "edge", "ac"),
        );
    });
});
