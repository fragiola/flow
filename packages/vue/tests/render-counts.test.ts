// Large flows (Epic #61, #60, React's `tests/render-counts.test.tsx`): what a change re-renders and
// reads again. A viewport step re-renders no node or edge whose visibility did not change, and
// reads none of their views again (`entity` readers skip it); dragging one node re-renders that
// node and its edges only; a culled flow renders no node or edge before the engine knows the view.
import type {
    FlowEdge,
    FlowEngine,
    FlowEngineOptions,
    FlowModel,
    FlowNode,
} from "@fragiola/flow";
import { drag as dragFeature } from "@fragiola/flow/drag";
import { selection } from "@fragiola/flow/selection";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, createSSRApp, defineComponent, h } from "vue";
import { renderToString } from "vue/server-renderer";
import { createFlowRef, Flow } from "../src/index";
import {
    drag,
    installLayout,
    part,
    pointer,
    render,
    settle,
    task,
} from "./flow";

/**
 * The engine reads of a node's or an edge's own view since the last reset, by key and by the
 * node or edge read (`node-z-index-by a`).
 */
const reads = new Map<string, number>();
const ENTITY_KEYS = new Set([
    "node-rect-by",
    "node-z-index-by",
    "edge-path-by",
    "node-focusable",
    "edge-focusable",
]);

vi.mock("@fragiola/flow", async (importOriginal) => {
    const core = await importOriginal<typeof import("@fragiola/flow")>();
    return {
        ...core,
        createFlowEngine(model: FlowModel, options: FlowEngineOptions) {
            const engine = core.createFlowEngine(model, options) as FlowEngine;
            const count = (key: string, payload?: unknown) => {
                if (!ENTITY_KEYS.has(key)) return;
                const { nodeId, edgeId } = (payload ?? {}) as {
                    nodeId?: string;
                    edgeId?: string;
                };
                const read = `${key} ${nodeId ?? edgeId}`;
                reads.set(read, (reads.get(read) ?? 0) + 1);
            };
            const get = (key: string, payload?: unknown) => {
                count(key, payload);
                return (engine.get as (k: string, p?: unknown) => unknown)(
                    key,
                    payload,
                );
            };
            const is = (key: string, payload?: unknown) => {
                count(key, payload);
                return (engine.is as (k: string, p?: unknown) => boolean)(
                    key,
                    payload,
                );
            };
            // the engine is frozen: a wrapper inherits it and overrides two verbs
            return Object.create(engine, {
                get: { value: get },
                is: { value: is },
            });
        },
    };
});

beforeEach(() => {
    installLayout();
});

/** Renders per node and per edge id (their parts' default slots run on each render). */
function counter() {
    const counts = new Map<string, number>();
    const seen = (id: string) => {
        counts.set(id, (counts.get(id) ?? 0) + 1);
    };
    return {
        seen,
        of: (id: string) => counts.get(id) ?? 0,
        reset: () => counts.clear(),
        ids: () => [...counts.keys()].sort(),
    };
}

const features = [dragFeature()] as const;
const layeredFeatures = [dragFeature(), selection()] as const;

// a chain a → b → c in the 800 × 600 view at zoom 1, and y → z beside it, in view once zoomed out
const nodes = [
    task("a", 0, 0),
    task("b", 0, 200),
    task("c", 200, 200),
    task("y", 1200, 0),
    task("z", 1200, 200),
];
const edges = [
    { id: "ab", source: "a", target: "b" },
    { id: "bc", source: "b", target: "c" },
    { id: "yz", source: "y", target: "z" },
];

/**
 * A flow whose nodes, edges and edge paths count their renders, with the root's props. Its content
 * is a component that renders once, with slots made once (an app's compiled template): a render of
 * the root or the viewport gives the layers the same slots, so no entity re-renders for them.
 */
function countedFlow(
    renders: ReturnType<typeof counter>,
    root: Record<string, unknown> = {},
) {
    const Content = defineComponent({
        setup() {
            const edgeSlot = ({ edge }: { edge: FlowEdge }) => [
                h(Flow.Edge, { edge }, () => {
                    renders.seen(`edge ${edge.id}`);
                    return [
                        h(Flow.EdgePath, null, () => {
                            renders.seen(`path ${edge.id}`);
                            return [];
                        }),
                    ];
                }),
            ];
            const nodeSlot = ({ node }: { node: FlowNode }) => [
                h(Flow.Node, { node }, () => {
                    renders.seen(`node ${node.id}`);
                    return [
                        h(Flow.Handle, { type: "target", side: "top" }),
                        h(Flow.Handle, { type: "source", side: "bottom" }),
                    ];
                }),
            ];
            const layers = () => [
                h(Flow.Edges, null, { default: edgeSlot }),
                h(Flow.Nodes, null, { default: nodeSlot }),
            ];
            return () => h(Flow.Viewport, null, layers);
        },
    });
    return () =>
        h(
            Flow.Root,
            {
                features,
                defaultNodes: nodes,
                defaultEdges: edges,
                ...root,
            },
            () => h(Content),
        );
}

async function wheel(target: Element, deltaY: number): Promise<void> {
    target.dispatchEvent(
        new WheelEvent("wheel", {
            bubbles: true,
            cancelable: true,
            deltaY,
            clientX: 100,
            clientY: 100,
        }),
    );
    await settle();
}

describe("render counts", () => {
    it("a viewport step re-renders no node or edge whose visibility did not change, and reads none of their views", async () => {
        const renders = counter();
        const { container } = await render(
            countedFlow(renders, { onlyRenderVisible: true }),
        );
        expect(renders.ids()).toEqual([
            "edge ab",
            "edge bc",
            "node a",
            "node b",
            "node c",
            "path ab",
            "path bc",
        ]);
        const root = part(container, "root");
        // a pan of a few pixels and zoom steps: the same nodes and edges in view. The press and
        // the release change the gesture's state (`data-panning`), the steps only the viewport.
        await pointer(part(container, "viewport"), "pointerdown", {
            clientX: 700,
            clientY: 500,
        });
        await pointer(root, "pointermove", { clientX: 690, clientY: 495 });
        renders.reset();
        reads.clear();
        await pointer(root, "pointermove", { clientX: 680, clientY: 490 });
        await pointer(root, "pointermove", { clientX: 670, clientY: 485 });
        expect(renders.ids()).toEqual([]);
        expect(reads.size).toBe(0);
        await pointer(root, "pointerup", { clientX: 670, clientY: 485 });
        renders.reset();
        reads.clear();
        await wheel(root, -10);
        await wheel(root, 10);
        expect(renders.ids()).toEqual([]);
        expect(reads.size).toBe(0);
    });

    it("a viewport step that brings a node into view renders that node and its edges only", async () => {
        const renders = counter();
        const { container } = await render(
            countedFlow(renders, { onlyRenderVisible: true }),
        );
        renders.reset();
        const root = part(container, "root");
        reads.clear();
        // zoomed out to the minimum (0.5): y and z come into view
        for (let i = 0; i < 12; i++) await wheel(root, 100);
        expect(renders.ids()).toEqual([
            "edge yz",
            "node y",
            "node z",
            "path yz",
        ]);
        // their measurement reads the nodes and edges that stayed only to see it left them alone
        const others = [...reads.keys()].filter(
            (read) => !/ [yz]$|yz$/.test(read),
        );
        expect(others.sort()).toEqual([
            "edge-path-by ab",
            "edge-path-by bc",
            "node-rect-by a",
            "node-rect-by b",
            "node-rect-by c",
        ]);
    });

    it("a viewport step that changes the render levels places the nodes again", async () => {
        const flow = createFlowRef();
        const renders = counter();
        // a selected edge stands above the nodes (zIndexMode "auto"): several levels while it is
        // drawn, so the nodes' z-index are ranks; panned out of view, one level again, with no node
        // mounted or unmounted
        const { container } = await render(
            countedFlow(renders, {
                features: layeredFeatures,
                defaultEdges: [
                    { id: "ab", source: "a", target: "b", selected: true },
                    { id: "yz", source: "y", target: "z" },
                ],
                onlyRenderVisible: true,
                flowRef: flow,
            }),
        );
        const zOf = (id: string) => part(container, "node", id).style.zIndex;
        const engine = () => flow.value?.engine;
        expect(engine()?.get("render-layers")).toHaveLength(2);
        expect(Number(zOf("c"))).toBeLessThan(0);
        const root = part(container, "root");
        // 60 pixels to the left: the edge's ends (the middle of a's bottom and of b's top) leave
        // the view, every node stays. Checked before the release (which changes the gesture's
        // state, and so reads every node again); the first step starts the pan (the same).
        await pointer(part(container, "viewport"), "pointerdown", {
            clientX: 700,
            clientY: 500,
        });
        await pointer(root, "pointermove", { clientX: 699, clientY: 500 });
        await pointer(root, "pointermove", { clientX: 640, clientY: 500 });
        expect(engine()?.get("render-layers")).toHaveLength(1);
        expect(
            container.querySelectorAll('[data-flow-part="node"]'),
        ).toHaveLength(3);
        expect(
            container.querySelector(
                '[data-flow-part="edge"][data-flow-id="ab"]',
            ),
        ).toBeNull();
        for (const id of ["a", "b", "c"]) {
            expect(zOf(id)).toBe(
                String(engine()?.get("node-z-index-by", { nodeId: id })),
            );
        }
        await pointer(root, "pointerup", { clientX: 640, clientY: 500 });
    });

    it("dragging one node re-renders that node and its edges only", async () => {
        const renders = counter();
        const { container } = await render(countedFlow(renders));
        renders.reset();
        reads.clear();
        const root = part(container, "root");
        await drag(part(container, "node", "a"), root, [
            { clientX: 50, clientY: 20 },
            { clientX: 70, clientY: 30 },
            { clientX: 90, clientY: 40 },
        ]);
        expect(renders.ids()).toEqual(["edge ab", "node a", "path ab"]);
        expect(renders.of("node a")).toBeGreaterThan(0);
    });

    it("renders no node or edge of a culled flow before the engine knows the view, every one otherwise", async () => {
        const culled = counter();
        const html = await renderToString(
            createSSRApp({
                render: countedFlow(culled, { onlyRenderVisible: true }),
            }),
        );
        expect(html).toContain('data-flow-part="nodes"');
        expect(html).toContain('data-flow-part="edges"');
        expect(html).not.toContain('data-flow-part="node"');
        expect(html).not.toContain('data-flow-part="edge"');
        expect(culled.ids()).toEqual([]);
        const all = counter();
        await renderToString(createSSRApp({ render: countedFlow(all) }));
        expect(all.ids()).toEqual([
            "edge ab",
            "edge bc",
            "edge yz",
            "node a",
            "node b",
            "node c",
            "node y",
            "node z",
            "path ab",
            "path bc",
            "path yz",
        ]);
    });

    it("mounts no node or edge of a culled flow before the engine, then the ones in view", async () => {
        const renders = counter();
        const host = document.createElement("div");
        document.body.append(host);
        const app = createApp({
            render: countedFlow(renders, { onlyRenderVisible: true }),
        });
        app.mount(host);
        // the first render (no engine yet): nothing rendered
        expect(renders.ids()).toEqual([]);
        await settle();
        expect(renders.ids()).toEqual([
            "edge ab",
            "edge bc",
            "node a",
            "node b",
            "node c",
            "path ab",
            "path bc",
        ]);
        app.unmount();
        host.remove();
    });
});
