// Large flows (#54, Vue's and React's `render-counts` tests): what a change renders and reads
// again. A viewport step renders no node or edge whose visibility did not change, and reads none of
// their views again (`entity` readers are not told it); nodes brought into view render alone;
// dragging one node renders that node and its edges only; a step that changes the render levels
// places the nodes again; a culled flow renders no node or edge before the engine knows the view.
// The renders are counted by probes (`fixtures/render-probe.svelte`: an effect on a part's state),
// the reads by a wrapped engine.
import type { FlowEngine, FlowEngineOptions, FlowModel } from "@fragiola/flow";
import { drag as dragFeature } from "@fragiola/flow/drag";
import { selection } from "@fragiola/flow/selection";
import { mount, unmount } from "svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type AnyTypes, createFlowRef, type FlowFeatures } from "../src/index";
import CountFlow from "./fixtures/count-flow.svelte";
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
const { reads, ENTITY_KEYS } = vi.hoisted(() => ({
    reads: new Map<string, number>(),
    ENTITY_KEYS: new Set([
        "node-rect-by",
        "node-z-index-by",
        "edge-path-by",
        "node-focusable",
        "edge-focusable",
    ]) as ReadonlySet<string>,
}));

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
            // the engine is frozen (bound verbs): a wrapper inherits it and overrides two
            return Object.create(engine, {
                get: { value: get },
                is: { value: is },
            });
        },
    };
});

beforeEach(() => {
    installLayout();
    reads.clear();
});

/** Renders per node, edge and edge path (`node a`, `edge ab`, `path ab`). */
function counter() {
    const counts = new Map<string, number>();
    return {
        seen: (id: string) => {
            counts.set(id, (counts.get(id) ?? 0) + 1);
        },
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
const IN_VIEW = [
    "edge ab",
    "edge bc",
    "node a",
    "node b",
    "node c",
    "path ab",
    "path bc",
];

const flowProps = (
    renders: ReturnType<typeof counter>,
    root: Record<string, unknown> = {},
) => ({
    features,
    defaultNodes: nodes,
    defaultEdges: edges,
    seen: renders.seen,
    ...root,
});

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
    it("a viewport step renders no node or edge whose visibility did not change, and reads none of their views", async () => {
        const renders = counter();
        const { container } = await render(
            CountFlow,
            flowProps(renders, { onlyRenderVisible: true }),
        );
        expect(renders.ids()).toEqual(IN_VIEW);
        const root = part(container, "root");
        // a pan of a few pixels and zoom steps: the same nodes and edges in view. The press and
        // the first move start the gesture (`data-panning`), the next steps change the viewport only
        await pointer(part(container, "viewport"), "pointerdown", {
            clientX: 700,
            clientY: 500,
        });
        await pointer(root, "pointermove", { clientX: 690, clientY: 495 });
        renders.reset();
        reads.clear();
        const before = part(container, "viewport").style.transform;
        await pointer(root, "pointermove", { clientX: 680, clientY: 490 });
        await pointer(root, "pointermove", { clientX: 670, clientY: 485 });
        // it did pan
        expect(part(container, "viewport").style.transform).not.toBe(before);
        expect(renders.ids()).toEqual([]);
        expect([...reads.keys()]).toEqual([]);
        await pointer(root, "pointerup", { clientX: 670, clientY: 485 });
        renders.reset();
        reads.clear();
        await wheel(root, -10);
        await wheel(root, 10);
        expect(renders.ids()).toEqual([]);
        expect([...reads.keys()]).toEqual([]);
    });

    it("a viewport step that brings nodes into view renders those nodes and their edges only", async () => {
        const renders = counter();
        const { container } = await render(
            CountFlow,
            flowProps(renders, { onlyRenderVisible: true }),
        );
        renders.reset();
        reads.clear();
        const root = part(container, "root");
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
        const flow = createFlowRef<AnyTypes, FlowFeatures>();
        const renders = counter();
        // a selected edge stands above the nodes (zIndexMode "auto"): several levels while it is
        // drawn, so the nodes' z-index are ranks; panned out of view, one level again, with no
        // node mounted or unmounted
        const { container } = await render(
            CountFlow,
            flowProps(renders, {
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
        const engine = () => flow.current?.engine;
        expect(engine()?.get("render-layers")).toHaveLength(2);
        expect(Number(zOf("c"))).toBeLessThan(0);
        const root = part(container, "root");
        // 60 pixels to the left: the edge's ends leave the view, every node stays. Checked
        // before the release (which changes the gesture's state, and so reads every node again)
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

    it("dragging one node renders that node and its edges only", async () => {
        const renders = counter();
        const { container } = await render(CountFlow, flowProps(renders));
        renders.reset();
        const root = part(container, "root");
        await drag(part(container, "node", "a"), root, [
            { clientX: 50, clientY: 20 },
            { clientX: 70, clientY: 30 },
            { clientX: 90, clientY: 40 },
        ]);
        expect(part(container, "node", "a").style.transform).toBe(
            "translate(40px, 20px)",
        );
        expect(renders.ids()).toEqual(["edge ab", "node a", "path ab"]);
        expect(renders.of("node a")).toBeGreaterThan(1);
    });

    it("mounts no node or edge of a culled flow before the engine, then the ones in view", async () => {
        const renders = counter();
        const target = document.body.appendChild(document.createElement("div"));
        const app = mount(CountFlow, {
            target,
            // the features are not inferred through the fixture's props
            props: flowProps(renders, { onlyRenderVisible: true }) as never,
        });
        // the first render (its effects not run: no engine yet): the layers, no node or edge
        expect(part(target, "root").style.touchAction).toBe("");
        expect(part(target, "nodes")).toBeTruthy();
        expect(part(target, "edges")).toBeTruthy();
        expect(target.querySelector('[data-flow-part="node"]')).toBeNull();
        expect(target.querySelector('[data-flow-part="edge"]')).toBeNull();
        expect(renders.ids()).toEqual([]);
        await settle();
        expect(part(target, "root").style.touchAction).toBe("none");
        expect(renders.ids()).toEqual(IN_VIEW);
        await unmount(app);
    });

    it("mounts every node of a flow that is not culled in its first render", async () => {
        const renders = counter();
        const target = document.body.appendChild(document.createElement("div"));
        const app = mount(CountFlow, {
            target,
            props: flowProps(renders) as never,
        });
        expect(target.querySelectorAll('[data-flow-part="node"]')).toHaveLength(
            5,
        );
        await settle();
        expect(target.querySelectorAll('[data-flow-part="node"]')).toHaveLength(
            5,
        );
        await unmount(app);
    });
});
