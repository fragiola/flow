// #36: the parts' new props (the minimap's inversePan, zoomStep and onClick, the resizer's
// direction, the fit-view button's framing, the edge toolbar's point and alignment), the
// rectangle around a box selection (`Flow.NodesSelection`) and the root's selection-drag
// callbacks.
import { drag as dragFeature } from "@fragiola/flow/drag";
import { selection } from "@fragiola/flow/selection";
import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFlowRef, Flow, type XY } from "../src/index";
import { MiniMap, minimap } from "../src/minimap/index";
import { NodeResizer, resize } from "../src/resize/index";
import {
    drag,
    installLayout,
    pair,
    part,
    pointer,
    settle,
    TestFlow,
    task,
} from "./flow";

beforeEach(() => {
    installLayout();
});

const viewportOf = (container: HTMLElement) =>
    part(container, "viewport").style.transform;

describe("MiniMap", () => {
    it("pans the other way with inversePan, zooms by zoomStep, and calls onClick with the flow point", async () => {
        const clicks: XY[] = [];
        const onClick = vi.fn((_event: MouseEvent, point: XY) => {
            clicks.push(point);
        });
        const { container, rerender } = render(
            <TestFlow
                features={[minimap()]}
                defaultNodes={[task("a"), task("b", 400, 300)]}
            >
                <MiniMap inversePan zoomStep={20} onClick={onClick} />
            </TestFlow>,
        );
        await settle();
        const map = part(container, "minimap");
        const root = part(container, "root");
        const before = viewportOf(container);
        // a press does not centre the view; a drag right moves the view left
        pointer(map, "pointerdown", { clientX: 100, clientY: 75 });
        expect(viewportOf(container)).toBe(before);
        pointer(root, "pointermove", { clientX: 120, clientY: 75 });
        pointer(root, "pointerup", { clientX: 120, clientY: 75 });
        const moved = /translate\((-?[\d.]+)px/.exec(viewportOf(container));
        expect(Number(moved?.[1])).toBeGreaterThan(0);
        expect(onClick).not.toHaveBeenCalled();
        // a tap is a click, at the flow point under it
        pointer(map, "pointerdown", { clientX: 100, clientY: 75 });
        pointer(root, "pointerup", { clientX: 100, clientY: 75 });
        expect(onClick).toHaveBeenCalledTimes(1);
        expect(onClick.mock.calls[0]?.[0]).toBeInstanceOf(PointerEvent);
        expect(clicks[0]?.x).toBeTypeOf("number");
        // zoomStep 20: twice the wheel's default rate
        const zoomOf = () =>
            Number(/scale\(([\d.]+)\)/.exec(viewportOf(container))?.[1]);
        const wheel = () =>
            fireEvent.wheel(map, { deltaY: -100, clientX: 100, clientY: 75 });
        const start = zoomOf();
        wheel();
        const fast = zoomOf() / start;
        rerender(
            <TestFlow
                features={[minimap()]}
                defaultNodes={[task("a"), task("b", 400, 300)]}
            >
                <MiniMap />
            </TestFlow>,
        );
        await settle();
        const middle = zoomOf();
        wheel();
        const slow = zoomOf() / middle;
        expect(Math.log(fast)).toBeCloseTo(2 * Math.log(slow));
    });
});

describe("NodeResizer", () => {
    it("moves only the width with direction horizontal, a corner too", async () => {
        const { container } = render(
            <Flow.Root features={[resize()]} defaultNodes={[task("a")]}>
                <Flow.Viewport>
                    <Flow.Nodes>
                        {(node) => (
                            <Flow.Node node={node}>
                                <NodeResizer direction="horizontal" />
                            </Flow.Node>
                        )}
                    </Flow.Nodes>
                </Flow.Viewport>
            </Flow.Root>,
        );
        await settle();
        const corner = container.querySelector(
            '[data-position="bottom-right"]',
        ) as HTMLElement;
        drag(corner, part(container, "root"), [
            { clientX: 100, clientY: 40 },
            { clientX: 160, clientY: 90 },
        ]);
        await settle();
        const node = part(container, "node", "a");
        expect(node.style.width).toBe("160px");
        expect(node.style.height).toBe("40px");
    });
});

describe("FitView", () => {
    it("frames its nodeIds with its padding and zoom limits", async () => {
        const ref = createFlowRef();
        const { getByTestId } = render(
            <TestFlow
                flowRef={ref}
                defaultNodes={[task("a"), task("b", 1000, 1000)]}
            >
                <Flow.FitView
                    data-testid="fit"
                    nodeIds={["b"]}
                    padding="0px"
                    maxZoom={1.5}
                />
            </TestFlow>,
        );
        await settle();
        fireEvent.click(getByTestId("fit"));
        const engine = ref.current?.engine;
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
        const view = render(
            <Flow.Root defaultNodes={pair().nodes} defaultEdges={pair().edges}>
                <Flow.Viewport>
                    <Flow.Edges>
                        {(edge) => (
                            <Flow.Edge edge={edge}>
                                <Flow.EdgeToolbar
                                    data-testid="toolbar"
                                    open
                                    point={{ x: 10, y: 20 }}
                                    alignX="start"
                                    alignY="end"
                                />
                            </Flow.Edge>
                        )}
                    </Flow.Edges>
                    <Flow.Nodes>
                        {(node) => (
                            <Flow.Node node={node}>
                                <Flow.Handle type="target" side="top" />
                                <Flow.Handle type="source" side="bottom" />
                            </Flow.Node>
                        )}
                    </Flow.Nodes>
                </Flow.Viewport>
            </Flow.Root>,
        );
        await settle();
        await settle();
        expect(view.getByTestId("toolbar").style.transform).toBe(
            "translate(10px, 20px) translate(0%, -100%)",
        );
    });
});

describe("Flow.NodesSelection", () => {
    it("draws the rectangle around a box selection in flow coordinates, and drags the selection by it", async () => {
        const starts = vi.fn();
        const steps = vi.fn();
        const stops = vi.fn();
        const { container } = render(
            <Flow.Root
                features={[selection(), dragFeature()]}
                defaultNodes={[task("a"), task("b", 200, 100)]}
                defaultViewport={{ x: 0, y: 0, zoom: 1 }}
                onSelectionDragStart={starts}
                onSelectionDrag={steps}
                onSelectionDragStop={stops}
            >
                <Flow.Viewport>
                    <Flow.Nodes>
                        {(node) => <Flow.Node node={node} />}
                    </Flow.Nodes>
                    <Flow.NodesSelection data-testid="rect" />
                </Flow.Viewport>
            </Flow.Root>,
        );
        await settle();
        expect(
            container.querySelector('[data-flow-part="nodes-selection"]'),
        ).toBeNull();
        const root = part(container, "root");
        pointer(part(container, "viewport"), "pointerdown", {
            clientX: -10,
            clientY: -10,
            shiftKey: true,
        });
        pointer(root, "pointermove", {
            clientX: 400,
            clientY: 300,
            shiftKey: true,
        });
        pointer(root, "pointerup", {
            clientX: 400,
            clientY: 300,
            shiftKey: true,
        });
        await settle();
        const rect = part(container, "nodes-selection");
        expect(rect.parentElement).toBe(part(container, "viewport"));
        expect(rect.style.position).toBe("absolute");
        expect(rect.style.transform).toBe("translate(0px, 0px)");
        expect(rect.style.width).toBe("300px");
        expect(rect.style.height).toBe("140px");
        drag(rect, root, [
            { clientX: 50, clientY: 50 },
            { clientX: 60, clientY: 50 },
            { clientX: 80, clientY: 70 },
        ]);
        await settle();
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
