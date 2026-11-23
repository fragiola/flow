// Large flows (Epic #61, #60): what a change re-renders and reads again. A viewport step re-renders
// no node or edge whose visibility did not change, and reads none of their views again (`entity`
// readers skip it); dragging one node re-renders that node and its edges only; a culled flow
// renders no node or edge before the engine knows the view.
import type {
    AnyTypes,
    FlowEngine,
    FlowEngineOptions,
    FlowFeatures,
    FlowModel,
} from "@fragiola/flow";
import { drag as dragFeature } from "@fragiola/flow/drag";
import { selection } from "@fragiola/flow/selection";
import { act, render } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFlowRef, Flow, type RootProps } from "../src/index";
import { drag, installLayout, part, pointer, settle, task } from "./flow";

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

/** Renders per node and per edge id (their parts' `className` functions run on each render). */
function counter() {
    const counts = new Map<string, number>();
    const seen = (id: string) => {
        counts.set(id, (counts.get(id) ?? 0) + 1);
        return undefined;
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

function CountedFlow(
    props: { renders: ReturnType<typeof counter> } & Partial<
        RootProps<AnyTypes, FlowFeatures>
    >,
) {
    const { renders, ...root } = props;
    return (
        <Flow.Root
            features={features}
            defaultNodes={nodes}
            defaultEdges={edges}
            {...root}
        >
            <Flow.Viewport>
                <Flow.Edges>
                    {(edge) => (
                        <Flow.Edge
                            edge={edge}
                            className={() => renders.seen(`edge ${edge.id}`)}
                        >
                            <Flow.EdgePath
                                className={() =>
                                    renders.seen(`path ${edge.id}`)
                                }
                            />
                        </Flow.Edge>
                    )}
                </Flow.Edges>
                <Flow.Nodes>
                    {(node) => (
                        <Flow.Node
                            node={node}
                            className={() => renders.seen(`node ${node.id}`)}
                        >
                            <Flow.Handle type="target" side="top" />
                            <Flow.Handle type="source" side="bottom" />
                        </Flow.Node>
                    )}
                </Flow.Nodes>
            </Flow.Viewport>
        </Flow.Root>
    );
}

function wheel(target: Element, deltaY: number) {
    act(() => {
        target.dispatchEvent(
            new WheelEvent("wheel", {
                bubbles: true,
                cancelable: true,
                deltaY,
                clientX: 100,
                clientY: 100,
            }),
        );
    });
}

describe("render counts", () => {
    it("a viewport step re-renders no node or edge whose visibility did not change, and reads none of their views", async () => {
        const renders = counter();
        const { container } = render(
            <CountedFlow renders={renders} onlyRenderVisible />,
        );
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
        const root = part(container, "root");
        // a pan of a few pixels and zoom steps: the same nodes and edges in view. The press and
        // the release change the gesture's state (`data-panning`), the steps only the viewport.
        pointer(part(container, "viewport"), "pointerdown", {
            clientX: 700,
            clientY: 500,
        });
        pointer(root, "pointermove", { clientX: 690, clientY: 495 });
        await settle();
        renders.reset();
        reads.clear();
        pointer(root, "pointermove", { clientX: 680, clientY: 490 });
        pointer(root, "pointermove", { clientX: 670, clientY: 485 });
        await settle();
        expect(renders.ids()).toEqual([]);
        expect(reads.size).toBe(0);
        pointer(root, "pointerup", { clientX: 670, clientY: 485 });
        await settle();
        renders.reset();
        reads.clear();
        wheel(root, -10);
        wheel(root, 10);
        await settle();
        expect(renders.ids()).toEqual([]);
        expect(reads.size).toBe(0);
    });

    it("a viewport step that brings a node into view renders that node and its edges only", async () => {
        const renders = counter();
        const { container } = render(
            <CountedFlow renders={renders} onlyRenderVisible />,
        );
        await settle();
        renders.reset();
        const root = part(container, "root");
        reads.clear();
        // zoomed out to the minimum (0.5): y and z come into view
        for (let i = 0; i < 12; i++) wheel(root, 100);
        await settle();
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
        const { container } = render(
            <CountedFlow
                renders={renders}
                features={layeredFeatures}
                defaultEdges={[
                    { id: "ab", source: "a", target: "b", selected: true },
                    { id: "yz", source: "y", target: "z" },
                ]}
                onlyRenderVisible
                flowRef={flow}
            />,
        );
        await settle();
        const zOf = (id: string) => part(container, "node", id).style.zIndex;
        const engine = () => flow.current?.engine;
        expect(engine()?.get("render-layers")).toHaveLength(2);
        expect(Number(zOf("c"))).toBeLessThan(0);
        const root = part(container, "root");
        // 60 pixels to the left: the edge's ends (the middle of a's bottom and of b's top) leave
        // the view, every node stays. Checked before the release (which changes the gesture's
        // state, and so reads every node again); the first step starts the pan (the same).
        pointer(part(container, "viewport"), "pointerdown", {
            clientX: 700,
            clientY: 500,
        });
        pointer(root, "pointermove", { clientX: 699, clientY: 500 });
        await settle();
        pointer(root, "pointermove", { clientX: 640, clientY: 500 });
        await settle();
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
        pointer(root, "pointerup", { clientX: 640, clientY: 500 });
    });

    it("dragging one node re-renders that node and its edges only", async () => {
        const renders = counter();
        const { container } = render(<CountedFlow renders={renders} />);
        await settle();
        renders.reset();
        reads.clear();
        const root = part(container, "root");
        drag(part(container, "node", "a"), root, [
            { clientX: 50, clientY: 20 },
            { clientX: 70, clientY: 30 },
            { clientX: 90, clientY: 40 },
        ]);
        await settle();
        expect(renders.ids()).toEqual(["edge ab", "node a", "path ab"]);
        expect(renders.of("node a")).toBeGreaterThan(0);
    });

    it("renders no node or edge of a culled flow before the engine knows the view, every one otherwise", () => {
        const culled = counter();
        expect(
            renderToString(<CountedFlow renders={culled} onlyRenderVisible />),
        ).not.toContain('data-flow-part="node"');
        expect(culled.ids()).toEqual([]);
        const all = counter();
        renderToString(<CountedFlow renders={all} />);
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
});
