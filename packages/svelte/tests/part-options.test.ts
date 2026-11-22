// #36: the parts' new props (the minimap's inversePan, zoomStep and onclick, the resizer's
// direction, the fit-view button's framing, the edge toolbar's point and alignment), the
// rectangle around a box selection (`Flow.NodesSelection`) and the root's selection-drag
// callbacks (React's tests/part-options.test.tsx).
import { drag as dragFeature } from "@fragiola/flow/drag";
import { minimap } from "@fragiola/flow/minimap";
import { resize } from "@fragiola/flow/resize";
import { selection } from "@fragiola/flow/selection";
import { fireEvent } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    type AnyTypes,
    createFlowRef,
    type FlowFeatures,
    type XY,
} from "../src/index";
import PartOptionsFlow from "./fixtures/part-options-flow.svelte";
import {
    click,
    drag,
    installLayout,
    pair,
    part,
    pointer,
    render,
    settle,
    task,
} from "./flow";

beforeEach(() => {
    installLayout();
});

const viewportOf = (container: HTMLElement) =>
    part(container, "viewport").style.transform;
const byTestId = (container: HTMLElement, id: string) =>
    container.querySelector<HTMLElement>(`[data-testid="${id}"]`);

describe("MiniMap", () => {
    it("pans the other way with inversePan, zooms by zoomStep, and calls onclick with the flow point", async () => {
        const points: XY[] = [];
        const onclick = vi.fn((_event: MouseEvent, point: XY) => {
            points.push(point);
        });
        const flow = {
            features: [minimap()],
            defaultNodes: [task("a"), task("b", 400, 300)],
        };
        const { container, rerender } = await render(PartOptionsFlow, {
            ...flow,
            minimap: { inversePan: true, zoomStep: 20, onclick },
        });
        const map = part(container, "minimap");
        const root = part(container, "root");
        const before = viewportOf(container);
        // a press does not centre the view; a drag right moves the view left
        await pointer(map, "pointerdown", { clientX: 100, clientY: 75 });
        expect(viewportOf(container)).toBe(before);
        await pointer(root, "pointermove", { clientX: 130, clientY: 75 });
        await pointer(root, "pointerup", { clientX: 130, clientY: 75 });
        const moved = /translate\((-?[\d.]+)px/.exec(viewportOf(container));
        expect(Number(moved?.[1])).toBeGreaterThan(0);
        expect(onclick).not.toHaveBeenCalled();
        // a tap is a click, at the flow point under it
        await pointer(map, "pointerdown", { clientX: 100, clientY: 75 });
        await pointer(root, "pointerup", { clientX: 100, clientY: 75 });
        expect(onclick).toHaveBeenCalledTimes(1);
        expect(onclick.mock.calls[0]?.[0]).toBeInstanceOf(PointerEvent);
        expect(points[0]?.x).toBeTypeOf("number");
        // zoomStep 20: twice the wheel's default rate
        const zoomOf = () =>
            Number(/scale\(([\d.]+)\)/.exec(viewportOf(container))?.[1]);
        const wheel = async () => {
            await fireEvent.wheel(map, {
                deltaY: -100,
                clientX: 100,
                clientY: 75,
            });
            await settle();
        };
        const start = zoomOf();
        await wheel();
        const fast = zoomOf() / start;
        await rerender({ ...flow, minimap: {} });
        const middle = zoomOf();
        await wheel();
        const slow = zoomOf() / middle;
        expect(Math.log(fast)).toBeCloseTo(2 * Math.log(slow));
    });

    it("calls only the tapped minimap's onclick when the root draws two", async () => {
        const first = vi.fn();
        const second = vi.fn();
        const { container } = await render(PartOptionsFlow, {
            features: [minimap()],
            defaultNodes: [task("a")],
            minimaps: [{ onclick: first }, { onclick: second }],
        });
        const [mapA, mapB] = container.querySelectorAll(
            '[data-flow-part="minimap"]',
        );
        const root = part(container, "root");
        await pointer(mapA as Element, "pointerdown", {
            clientX: 100,
            clientY: 75,
        });
        await pointer(root, "pointerup", { clientX: 100, clientY: 75 });
        expect(first).toHaveBeenCalledTimes(1);
        expect(second).not.toHaveBeenCalled();
        await pointer(mapB as Element, "pointerdown", {
            clientX: 100,
            clientY: 75,
        });
        await pointer(root, "pointerup", { clientX: 100, clientY: 75 });
        expect(first).toHaveBeenCalledTimes(1);
        expect(second).toHaveBeenCalledTimes(1);
    });
});

describe("NodeResizer", () => {
    it("moves only the width with direction horizontal, a corner too", async () => {
        const { container } = await render(PartOptionsFlow, {
            features: [resize()],
            defaultNodes: [task("a")],
            resizer: { direction: "horizontal" },
        });
        const corner = container.querySelector(
            '[data-position="bottom-right"]',
        ) as HTMLElement;
        await drag(corner, part(container, "root"), [
            { clientX: 100, clientY: 40 },
            { clientX: 170, clientY: 95 },
        ]);
        const node = part(container, "node", "a");
        expect(node.style.width).toBe("170px");
        expect(node.style.height).toBe("40px");
    });
});

describe("FitView", () => {
    it("frames its nodeIds with its padding and zoom limits", async () => {
        const flow = createFlowRef<AnyTypes, FlowFeatures>();
        const { container } = await render(PartOptionsFlow, {
            flowRef: flow,
            defaultNodes: [task("a"), task("b", 900, 700)],
            fitView: { nodeIds: ["b"], padding: "0px", maxZoom: 1.25 },
        });
        await click(byTestId(container, "fit") as HTMLElement);
        const engine = flow.current?.engine;
        expect(engine?.get("viewport")).toEqual(
            engine?.get("viewport-for-bounds", {
                bounds: { x: 900, y: 700, width: 100, height: 40 },
                padding: "0px",
                maxZoom: 1.25,
            }),
        );
        expect(engine?.get("viewport").zoom).toBe(1.25);
    });
});

describe("EdgeToolbar", () => {
    it("stands at a flow point, with its end corner there", async () => {
        const { container } = await render(PartOptionsFlow, {
            defaultNodes: pair().nodes,
            defaultEdges: pair().edges,
            edgeToolbar: {
                open: true,
                point: { x: 30, y: 15 },
                alignX: "end",
                alignY: "start",
            },
        });
        await settle();
        expect(byTestId(container, "toolbar")?.style.transform).toBe(
            "translate(30px, 15px) translate(-100%, 0%)",
        );
    });
});

describe("Flow.NodesSelection", () => {
    it("draws the rectangle around a box selection in flow coordinates, and drags the selection by it", async () => {
        const starts = vi.fn();
        const steps = vi.fn();
        const stops = vi.fn();
        const { container } = await render(PartOptionsFlow, {
            features: [selection(), dragFeature()],
            defaultNodes: [task("a", 10, 10), task("b", 250, 150)],
            defaultViewport: { x: 0, y: 0, zoom: 1 },
            nodesSelection: true,
            onselectiondragstart: starts,
            onselectiondrag: steps,
            onselectiondragstop: stops,
        });
        expect(
            container.querySelector('[data-flow-part="nodes-selection"]'),
        ).toBeNull();
        const root = part(container, "root");
        await pointer(part(container, "viewport"), "pointerdown", {
            clientX: -5,
            clientY: -5,
            shiftKey: true,
        });
        await pointer(root, "pointermove", {
            clientX: 450,
            clientY: 350,
            shiftKey: true,
        });
        await pointer(root, "pointerup", {
            clientX: 450,
            clientY: 350,
            shiftKey: true,
        });
        const rect = part(container, "nodes-selection");
        expect(rect.parentElement).toBe(part(container, "viewport"));
        expect(rect).toHaveAttribute("data-testid", "rect");
        expect(rect.style.position).toBe("absolute");
        expect(rect.style.transform).toBe("translate(10px, 10px)");
        expect(rect.style.width).toBe("340px");
        expect(rect.style.height).toBe("180px");
        await drag(rect, root, [
            { clientX: 60, clientY: 60 },
            { clientX: 70, clientY: 60 },
            { clientX: 100, clientY: 85 },
        ]);
        expect(starts).toHaveBeenCalledTimes(1);
        expect(steps).toHaveBeenCalled();
        expect(stops).toHaveBeenCalledTimes(1);
        expect(stops.mock.calls[0]?.[0]).toMatchObject({
            type: "selection-drag-end",
            nodeIds: ["a", "b"],
        });
        expect(part(container, "node", "b").style.transform).toBe(
            "translate(290px, 175px)",
        );
        expect(part(container, "nodes-selection").style.transform).toBe(
            "translate(50px, 35px)",
        );
    });
});
