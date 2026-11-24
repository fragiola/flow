// Large flows (#57, Epic #58; React's `tests/render-counts.test.tsx`, Vue's and Svelte's): what a
// change re-renders and reads again. A viewport step re-renders no node or edge whose visibility
// did not change, and reads none of their views again (`entity` readers skip it); a step that
// brings nodes into view renders them alone, and their measurement reads only the others' boxes
// and paths; dragging one node re-renders that node and its edge only; a culled flow renders no
// node or edge before the engine knows the view (Angular has no server render: the browser's
// first render).
import { Component, input, untracked } from "@angular/core";
import { TestBed } from "@angular/core/testing";
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
import {
    type AnyTypes,
    createFlowRef,
    FLOW,
    type FlowFeatures,
    type FlowRef,
} from "../src/public-api";
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
const reads = vi.hoisted(() => new Map<string, number>());
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
    reads.clear();
});

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
] as FlowEdge[];

/** Renders per node and edge (`node a`, `edge ab`): each time its view is checked again. */
function counter() {
    const counts = new Map<string, number>();
    return {
        seen: (id: string) => counts.set(id, (counts.get(id) ?? 0) + 1),
        of: (id: string) => counts.get(id) ?? 0,
        reset: () => counts.clear(),
        ids: () => [...counts.keys()].sort(),
    };
}

/** A flow whose nodes and edges tell each check of their view (binding no output of the root's). */
@Component({
    selector: "test-counted-flow",
    imports: [FLOW],
    template: `
        <div
            flowRoot
            [features]="features()"
            [defaultNodes]="defaultNodes()"
            [defaultEdges]="defaultEdges()"
            [onlyRenderVisible]="onlyRenderVisible()"
            [minZoom]="0.5"
            [flowRef]="flowRef()"
        >
            <div flowViewport>
                <div flowEdges>
                    <ng-template flowEdgesItem let-edge>
                        <svg:g [flowEdge]="edge">
                            <svg:path flowEdgePath />
                            {{ probe("edge", edge) }}
                        </svg:g>
                    </ng-template>
                </div>
                <div flowNodes>
                    <ng-template flowNodesItem let-node>
                        <div [flowNode]="node">
                            {{ probe("node", node) }}
                            <div flowHandle type="target" side="top"></div>
                            <div flowHandle type="source" side="bottom"></div>
                        </div>
                    </ng-template>
                </div>
            </div>
        </div>
    `,
})
class CountedFlow {
    readonly features = input<FlowFeatures>(features);
    readonly defaultNodes = input<readonly FlowNode[]>(nodes);
    readonly defaultEdges = input<readonly FlowEdge[]>(edges);
    readonly onlyRenderVisible = input(false);
    readonly flowRef = input<FlowRef<AnyTypes, FlowFeatures> | undefined>();
    readonly onRender = input<(id: string) => void>();

    /** tells that a view read its entity again; renders nothing */
    probe(kind: string, entity: FlowNode | FlowEdge): string {
        untracked(() => this.onRender()?.(`${kind} ${entity.id}`));
        return "";
    }
}

/** A wheel turn at 100, 100 (React's and Vue's tests): zoomed out, y → z comes into view. */
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
        const { container } = await render(CountedFlow, {
            onlyRenderVisible: true,
            onRender: renders.seen,
        });
        expect(renders.ids()).toEqual([
            "edge ab",
            "edge bc",
            "node a",
            "node b",
            "node c",
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
        expect([...reads.keys()]).toEqual([]);
        await pointer(root, "pointerup", { clientX: 670, clientY: 485 });
        renders.reset();
        reads.clear();
        await wheel(root, -10);
        await wheel(root, 10);
        expect(renders.ids()).toEqual([]);
        expect([...reads.keys()]).toEqual([]);
    });

    it("a viewport step that brings nodes into view renders them alone, and their measurement reads only the others' boxes and paths", async () => {
        const renders = counter();
        const { container } = await render(CountedFlow, {
            onlyRenderVisible: true,
            onRender: renders.seen,
        });
        renders.reset();
        reads.clear();
        const root = part(container, "root");
        // zoomed out to the minimum (0.5): y and z come into view
        for (let i = 0; i < 12; i++) await wheel(root, 100);
        expect(renders.ids()).toEqual(["edge yz", "node y", "node z"]);
        // the measurement of y and z reads the nodes and edges that stayed only to see it left
        // them alone (the store's records)
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
        // a selected edge stands above the nodes (zIndexMode "auto"): several levels while it is
        // drawn, so the nodes' z-index are ranks; panned out of view, one level again, with no node
        // mounted or unmounted
        const { container } = await render(CountedFlow, {
            features: layeredFeatures,
            defaultEdges: [
                { id: "ab", source: "a", target: "b", selected: true },
                { id: "yz", source: "y", target: "z" },
            ],
            onlyRenderVisible: true,
            flowRef: flow,
        });
        const zOf = (id: string) => part(container, "node", id).style.zIndex;
        const engine = () => flow.current?.engine;
        expect(engine()?.get("render-layers")).toHaveLength(2);
        expect(Number(zOf("c"))).toBeLessThan(0);
        const root = part(container, "root");
        // 60 pixels to the left: the edge's ends leave the view, every node stays. Checked before
        // the release (which changes the gesture's state, and so reads every node again)
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

    it("dragging one node re-renders that node only, its edge's path following it", async () => {
        const renders = counter();
        const { container } = await render(CountedFlow, {
            onRender: renders.seen,
        });
        renders.reset();
        const root = part(container, "root");
        const pathOf = (id: string) =>
            part(container, "edge-path", id).getAttribute("d");
        const before = { ab: pathOf("ab"), bc: pathOf("bc") };
        await drag(part(container, "node", "a"), root, [
            { clientX: 50, clientY: 20 },
            { clientX: 70, clientY: 30 },
            { clientX: 90, clientY: 40 },
        ]);
        // an edge's view holds the app's elements only: its path's `d` is its part's own (an
        // effect of `flowEdgePath`), so the edge's view is not checked again (React re-renders it)
        expect(renders.ids()).toEqual(["node a"]);
        expect(pathOf("ab")).not.toBe(before.ab);
        expect(pathOf("bc")).toBe(before.bc);
    });
});

describe("a culled flow (onlyRenderVisible)", () => {
    /** The node and edge elements a render inserted, as the page saw them (even removed again). */
    async function inserted(onlyRenderVisible: boolean) {
        const added = new Set<string>();
        const observer = new MutationObserver((records) => {
            for (const record of records) {
                for (const node of record.addedNodes) {
                    if (!(node instanceof Element)) continue;
                    for (const element of [
                        node,
                        ...node.querySelectorAll("*"),
                    ]) {
                        const name = element.getAttribute("data-flow-part");
                        if (name === "node" || name === "edge") {
                            added.add(
                                `${name} ${element.getAttribute("data-flow-id")}`,
                            );
                        }
                    }
                }
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        const fixture = TestBed.createComponent(CountedFlow);
        document.body.append(fixture.nativeElement as HTMLElement);
        fixture.componentRef.setInput("onlyRenderVisible", onlyRenderVisible);
        await settle();
        await settle();
        observer.takeRecords();
        observer.disconnect();
        fixture.destroy();
        return [...added].sort();
    }

    it("inserts no node or edge before the engine knows the view: only the visible ones, ever", async () => {
        expect(await inserted(true)).toEqual([
            "edge ab",
            "edge bc",
            "node a",
            "node b",
            "node c",
        ]);
    });

    it("inserts every node and edge when it does not cull (the first render's static geometry)", async () => {
        expect(await inserted(false)).toEqual([
            "edge ab",
            "edge bc",
            "edge yz",
            "node a",
            "node b",
            "node c",
            "node y",
            "node z",
        ]);
    });
});
