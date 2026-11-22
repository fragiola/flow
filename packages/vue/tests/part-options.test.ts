// #36: the parts' new props (the minimap's inversePan, zoomStep and its `click` event, the
// resizer's direction, the fit-view button's framing, the edge toolbar's point and alignment), the
// rectangle around a box selection (`Flow.NodesSelection`) and the root's selection-drag events:
// React's `tests/part-options.test.tsx`.
import { drag as dragFeature } from "@fragiola/flow/drag";
import { selection } from "@fragiola/flow/selection";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { h, shallowRef } from "vue";
import { createFlowRef, Flow, type FlowEdge, type XY } from "../src/index";
import { MiniMap, minimap } from "../src/minimap/index";
import { NodeResizer, resize } from "../src/resize/index";
import {
    click,
    drag,
    installLayout,
    pair,
    part,
    pointer,
    render,
    settle,
    TestFlow,
    task,
} from "./flow";

beforeEach(() => {
    installLayout();
});

const viewportOf = (container: HTMLElement) =>
    part(container, "viewport").style.transform;

async function wheel(target: Element) {
    target.dispatchEvent(
        new WheelEvent("wheel", {
            bubbles: true,
            cancelable: true,
            deltaY: -100,
            clientX: 100,
            clientY: 75,
        }),
    );
    await settle();
}

describe("MiniMap", () => {
    it("pans the other way with inversePan, zooms by zoomStep, and emits click with the flow point", async () => {
        const clicks: XY[] = [];
        const onClick = vi.fn((_event: MouseEvent, point: XY) => {
            clicks.push(point);
        });
        const own = shallowRef<Record<string, unknown>>({
            inversePan: true,
            zoomStep: "20",
            onClick,
        });
        const { container } = await render(() =>
            h(
                TestFlow,
                {
                    features: [minimap()],
                    defaultNodes: [task("a"), task("b", 400, 300)],
                },
                () => [h(MiniMap, own.value)],
            ),
        );
        const map = part(container, "minimap");
        const root = part(container, "root");
        const before = viewportOf(container);
        // a press does not centre the view; a drag right moves the view left
        await pointer(map, "pointerdown", { clientX: 100, clientY: 75 });
        expect(viewportOf(container)).toBe(before);
        await pointer(root, "pointermove", { clientX: 120, clientY: 75 });
        await pointer(root, "pointerup", { clientX: 120, clientY: 75 });
        const moved = /translate\((-?[\d.]+)px/.exec(viewportOf(container));
        expect(Number(moved?.[1])).toBeGreaterThan(0);
        expect(onClick).not.toHaveBeenCalled();
        // a tap is a click, at the flow point under it
        await pointer(map, "pointerdown", { clientX: 100, clientY: 75 });
        await pointer(root, "pointerup", { clientX: 100, clientY: 75 });
        expect(onClick).toHaveBeenCalledTimes(1);
        expect(onClick.mock.calls[0]?.[0]).toBeInstanceOf(PointerEvent);
        expect(clicks[0]?.x).toBeTypeOf("number");
        // zoomStep 20 (its attribute's text): twice the wheel's default rate
        const zoomOf = () =>
            Number(/scale\(([\d.]+)\)/.exec(viewportOf(container))?.[1]);
        const start = zoomOf();
        await wheel(map);
        const fast = zoomOf() / start;
        own.value = {};
        await settle();
        const middle = zoomOf();
        await wheel(map);
        const slow = zoomOf() / middle;
        expect(Math.log(fast)).toBeCloseTo(2 * Math.log(slow));
    });
});

describe("NodeResizer", () => {
    it("moves only the width with direction horizontal, a corner too", async () => {
        const { container } = await render(() =>
            h(
                Flow.Root,
                { features: [resize()], defaultNodes: [task("a")] },
                () =>
                    h(Flow.Viewport, null, () =>
                        h(Flow.Nodes, null, {
                            default: ({ node }: { node: unknown }) => [
                                h(Flow.Node, { node } as never, () =>
                                    h(NodeResizer, { direction: "horizontal" }),
                                ),
                            ],
                        }),
                    ),
            ),
        );
        const corner = container.querySelector(
            '[data-position="bottom-right"]',
        ) as HTMLElement;
        await drag(corner, part(container, "root"), [
            { clientX: 100, clientY: 40 },
            { clientX: 160, clientY: 90 },
        ]);
        const node = part(container, "node", "a");
        expect(node.style.width).toBe("160px");
        expect(node.style.height).toBe("40px");
    });
});

describe("FitView", () => {
    it("frames its nodeIds with its padding and zoom limits", async () => {
        const flow = createFlowRef();
        const { container } = await render(() =>
            h(
                TestFlow,
                {
                    flowRef: flow,
                    defaultNodes: [task("a"), task("b", 1000, 1000)],
                },
                () => [
                    h(Flow.FitView, {
                        "data-testid": "fit",
                        nodeIds: ["b"],
                        padding: "0px",
                        maxZoom: "1.5",
                    }),
                ],
            ),
        );
        await click(
            container.querySelector('[data-testid="fit"]') as HTMLElement,
        );
        const engine = flow.value?.engine;
        expect(engine?.get("viewport")).toEqual(
            engine?.get("viewport-for-bounds", {
                bounds: { x: 1000, y: 1000, width: 100, height: 40 },
                padding: "0px",
                maxZoom: 1.5,
            }),
        );
        expect(engine?.get("viewport").zoom).toBe(1.5);
    });
});

describe("EdgeToolbar", () => {
    it("stands at a flow point, with its start corner there", async () => {
        const { nodes, edges } = pair();
        const { container } = await render(() =>
            h(Flow.Root, { defaultNodes: nodes, defaultEdges: edges }, () =>
                h(Flow.Viewport, null, () => [
                    h(Flow.Edges, null, {
                        default: ({ edge }: { edge: FlowEdge }) => [
                            h(Flow.Edge, { edge }, () =>
                                h(Flow.EdgeToolbar, {
                                    "data-testid": "toolbar",
                                    open: true,
                                    point: { x: 10, y: 20 },
                                    alignX: "start",
                                    alignY: "end",
                                }),
                            ),
                        ],
                    }),
                    h(Flow.Nodes, null, {
                        default: ({ node }: { node: unknown }) => [
                            h(Flow.Node, { node } as never, () => [
                                h(Flow.Handle, {
                                    type: "target",
                                    side: "top",
                                }),
                                h(Flow.Handle, {
                                    type: "source",
                                    side: "bottom",
                                }),
                            ]),
                        ],
                    }),
                ]),
            ),
        );
        await settle();
        const toolbar = container.querySelector(
            '[data-testid="toolbar"]',
        ) as HTMLElement;
        expect(toolbar.style.transform).toBe(
            "translate(10px, 20px) translate(0%, -100%)",
        );
    });
});

describe("Flow.NodesSelection", () => {
    it("draws the rectangle around a box selection in flow coordinates, and drags the selection by it", async () => {
        const starts = vi.fn();
        const steps = vi.fn();
        const stops = vi.fn();
        const { container } = await render(() =>
            h(
                Flow.Root,
                {
                    features: [selection(), dragFeature()],
                    defaultNodes: [task("a"), task("b", 200, 100)],
                    defaultViewport: { x: 0, y: 0, zoom: 1 },
                    onSelectionDragStart: starts,
                    onSelectionDrag: steps,
                    onSelectionDragStop: stops,
                },
                () =>
                    h(Flow.Viewport, null, () => [
                        h(Flow.Nodes, null, {
                            default: ({ node }: { node: unknown }) => [
                                h(Flow.Node, { node } as never),
                            ],
                        }),
                        h(Flow.NodesSelection, { "data-testid": "rect" }),
                    ]),
            ),
        );
        expect(
            container.querySelector('[data-flow-part="nodes-selection"]'),
        ).toBeNull();
        const root = part(container, "root");
        await pointer(part(container, "viewport"), "pointerdown", {
            clientX: -10,
            clientY: -10,
            shiftKey: true,
        });
        await pointer(root, "pointermove", {
            clientX: 400,
            clientY: 300,
            shiftKey: true,
        });
        await pointer(root, "pointerup", {
            clientX: 400,
            clientY: 300,
            shiftKey: true,
        });
        const rect = part(container, "nodes-selection");
        expect(rect.parentElement).toBe(part(container, "viewport"));
        expect(rect.style.position).toBe("absolute");
        expect(rect.style.transform).toBe("translate(0px, 0px)");
        expect(rect.style.width).toBe("300px");
        expect(rect.style.height).toBe("140px");
        await drag(rect, root, [
            { clientX: 50, clientY: 50 },
            { clientX: 60, clientY: 50 },
            { clientX: 80, clientY: 70 },
        ]);
        expect(starts).toHaveBeenCalledTimes(1);
        expect(steps).toHaveBeenCalled();
        expect(stops).toHaveBeenCalledTimes(1);
        expect(stops.mock.calls[0]?.[0]).toMatchObject({
            type: "selection-drag-end",
            nodeIds: ["a", "b"],
        });
        expect(part(container, "node", "b").style.transform).toBe(
            "translate(230px, 120px)",
        );
        expect(part(container, "nodes-selection").style.transform).toBe(
            "translate(30px, 20px)",
        );
    });
});
