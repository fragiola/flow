// #36: the parts' new inputs (the minimap's inversePan, zoomStep and minimapClick, the resizer's
// direction, the fit-view button's framing, the edge toolbar's point and alignment), the
// rectangle around a box selection (`[flowNodesSelection]`) and the root's selection-drag
// outputs: React's `tests/part-options.test.tsx`; #40: the rectangle's keyboard and
// `[flowResizeHandle]`'s direction and variant.
import { Component, input } from "@angular/core";
import { drag as dragFeature } from "@fragiola/flow/drag";
import { keyboard } from "@fragiola/flow/keyboard";
import { minimap } from "@fragiola/flow/minimap";
import { resize } from "@fragiola/flow/resize";
import { selection } from "@fragiola/flow/selection";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FLOW_MINIMAP } from "../src/minimap/index";
import {
    createFlowRef,
    FLOW,
    type FlowEngineEventOf,
    type FlowNode,
} from "../src/public-api";
import { FLOW_RESIZE } from "../src/resize/index";
import { ToolbarFlow } from "./fixtures";
import {
    drag,
    installLayout,
    key,
    pair,
    part,
    pointer,
    render,
    settle,
    task,
    wheel,
} from "./flow";

beforeEach(() => {
    installLayout();
});

const viewportOf = (container: HTMLElement) =>
    part(container, "viewport").style.transform;

/** Two nodes and a minimap, its inputs bound. */
@Component({
    selector: "test-minimap-options",
    imports: [FLOW, FLOW_MINIMAP],
    template: `
        <div flowRoot [features]="features" [defaultNodes]="nodes">
            <div flowViewport>
                <div flowNodes>
                    <div *flowNodesItem="let node" [flowNode]="node"></div>
                </div>
            </div>
            <svg flowMiniMap [inversePan]="inversePan()" [zoomStep]="zoomStep()" (minimapClick)="onClick()?.($event)"></svg>
        </div>
    `,
})
class MiniMapOptions {
    readonly inversePan = input<boolean | undefined>();
    readonly zoomStep = input<number | undefined>();
    readonly onClick =
        input<(event: FlowEngineEventOf<"minimap-click">) => void>();
    readonly features = [minimap()];
    readonly nodes: FlowNode[] = [task("a"), task("b", 400, 300)];
}

/** One node and two minimaps, each with its own click listener. */
@Component({
    selector: "test-two-minimaps",
    imports: [FLOW, FLOW_MINIMAP],
    template: `
        <div flowRoot [features]="features" [defaultNodes]="nodes">
            <div flowViewport>
                <div flowNodes>
                    <div *flowNodesItem="let node" [flowNode]="node"></div>
                </div>
            </div>
            <svg flowMiniMap (minimapClick)="first()?.()"></svg>
            <svg flowMiniMap (minimapClick)="second()?.()"></svg>
        </div>
    `,
})
class TwoMiniMaps {
    readonly first = input<() => void>();
    readonly second = input<() => void>();
    readonly features = [minimap()];
    readonly nodes: FlowNode[] = [task("a")];
}

describe("[flowMiniMap]", () => {
    it("emits minimapClick only on the tapped minimap when the root draws two", async () => {
        const first = vi.fn();
        const second = vi.fn();
        const { container } = await render(TwoMiniMaps, { first, second });
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

    it("pans the other way with inversePan, zooms by zoomStep, and emits minimapClick with the flow point", async () => {
        const onClick = vi.fn();
        const { container, set } = await render(MiniMapOptions, {
            inversePan: true,
            zoomStep: 20,
            onClick,
        });
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
        const event = onClick.mock.calls[0]?.[0] as
            | FlowEngineEventOf<"minimap-click">
            | undefined;
        expect(event?.type).toBe("minimap-click");
        expect(event?.event).toBeInstanceOf(PointerEvent);
        expect(event?.point.x).toBeTypeOf("number");
        // zoomStep 20: twice the wheel's default rate
        const zoomOf = () =>
            Number(/scale\(([\d.]+)\)/.exec(viewportOf(container))?.[1]);
        const start = zoomOf();
        await wheel(map, -100);
        const fast = zoomOf() / start;
        await set({ inversePan: undefined, zoomStep: undefined });
        const middle = zoomOf();
        await wheel(map, -100);
        const slow = zoomOf() / middle;
        expect(Math.log(fast)).toBeCloseTo(2 * Math.log(slow));
    });
});

/** A node with a horizontal resizer. */
@Component({
    selector: "test-resizer-direction",
    imports: [FLOW, FLOW_RESIZE],
    template: `
        <div flowRoot [features]="features" [defaultNodes]="nodes">
            <div flowViewport>
                <div flowNodes>
                    <div *flowNodesItem="let node" [flowNode]="node">
                        <div flowNodeResizer direction="horizontal"></div>
                    </div>
                </div>
            </div>
        </div>
    `,
})
class ResizerDirection {
    readonly features = [resize()];
    readonly nodes: FlowNode[] = [task("a")];
}

describe("[flowNodeResizer]", () => {
    it("moves only the width with direction horizontal, a corner too", async () => {
        const { container } = await render(ResizerDirection);
        const corner = container.querySelector(
            '[data-position="bottom-right"]',
        ) as HTMLElement;
        await drag(corner, part(container, "root"), [
            { clientX: 100, clientY: 40 },
            { clientX: 160, clientY: 90 },
        ]);
        await settle();
        const node = part(container, "node", "a");
        expect(node.style.width).toBe("160px");
        expect(node.style.height).toBe("40px");
    });
});

/** Two nodes and a fit-view button framing `b`. */
@Component({
    selector: "test-fit-view-framing",
    imports: [FLOW],
    template: `
        <div flowRoot [defaultNodes]="nodes" [flowRef]="flowRef()">
            <div flowViewport>
                <div flowNodes>
                    <div *flowNodesItem="let node" [flowNode]="node"></div>
                </div>
            </div>
            <button flowFitView data-testid="fit" [nodeIds]="['b']" padding="0px" [maxZoom]="1.5"></button>
        </div>
    `,
})
class FitViewFraming {
    readonly flowRef = input<ReturnType<typeof createFlowRef>>();
    readonly nodes: FlowNode[] = [task("a"), task("b", 1000, 1000)];
}

describe("[flowFitView]", () => {
    it("frames its nodeIds with its padding and zoom limits", async () => {
        const flowRef = createFlowRef();
        const { container } = await render(FitViewFraming, { flowRef });
        const button = container.querySelector(
            '[data-testid="fit"]',
        ) as HTMLElement;
        button.click();
        await settle();
        const engine = flowRef.current?.engine;
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

describe("[flowEdgeToolbar]", () => {
    it("stands at a flow point, with its start corner there", async () => {
        const { container } = await render(ToolbarFlow, {
            defaultNodes: pair().nodes,
            defaultEdges: pair().edges,
            edgeToolbar: {
                open: true,
                point: { x: 10, y: 20 },
                alignX: "start",
                alignY: "end",
            },
        });
        await settle();
        const toolbar = container.querySelector(
            '[data-testid="edge-toolbar"]',
        ) as HTMLElement;
        expect(toolbar.style.transform).toBe(
            "translate(10px, 20px) translate(0%, -100%)",
        );
    });
});

/** Two nodes, the rectangle around a box selection, and the selection-drag outputs. */
@Component({
    selector: "test-nodes-selection",
    imports: [FLOW],
    template: `
        <div
            flowRoot
            [features]="features"
            [defaultNodes]="nodes"
            [defaultViewport]="{ x: 0, y: 0, zoom: 1 }"
            (selectionDragStart)="starts()?.($event)"
            (selectionDrag)="steps()?.($event)"
            (selectionDragStop)="stops()?.($event)"
        >
            <div flowViewport>
                <div flowNodes>
                    <div *flowNodesItem="let node" [flowNode]="node"></div>
                </div>
                <div flowNodesSelection data-testid="rect"></div>
            </div>
        </div>
    `,
})
class NodesSelectionFlow {
    readonly starts = input<(event: unknown) => void>();
    readonly steps = input<(event: unknown) => void>();
    readonly stops = input<(event: unknown) => void>();
    readonly features = [selection(), dragFeature()];
    readonly nodes: FlowNode[] = [task("a"), task("b", 200, 100)];
}

describe("[flowNodesSelection]", () => {
    it("draws the rectangle around a box selection in flow coordinates, and drags the selection by it", async () => {
        const starts = vi.fn();
        const steps = vi.fn();
        const stops = vi.fn();
        const { container } = await render(NodesSelectionFlow, {
            starts,
            steps,
            stops,
        });
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

/** Two selected nodes, their rectangle always shown, with keyboard(). */
@Component({
    selector: "test-nodes-selection-keyboard",
    imports: [FLOW],
    template: `
        <div flowRoot [features]="features" [defaultNodes]="nodes" [defaultViewport]="{ x: 0, y: 0, zoom: 1 }">
            <div flowViewport>
                <div flowNodes>
                    <div *flowNodesItem="let node" [flowNode]="node"></div>
                </div>
                <div flowNodesSelection></div>
            </div>
        </div>
    `,
})
class NodesSelectionKeyboard {
    readonly features = [selection({ rect: "always" }), keyboard({ step: 5 })];
    readonly nodes: FlowNode[] = [
        task("a", 0, 0, { selected: true }),
        task("b", 200, 100, { selected: true }),
    ];
}

describe("[flowNodesSelection] with keyboard()", () => {
    it("takes focus, and the arrows on it move the selection", async () => {
        const { container } = await render(NodesSelectionKeyboard);
        const rect = part(container, "nodes-selection");
        expect(rect.getAttribute("tabindex")).toBe("0");
        rect.focus();
        expect(document.activeElement).toBe(rect);
        await key(rect, "ArrowRight");
        await settle();
        expect(part(container, "node", "a").style.transform).toBe(
            "translate(5px, 0px)",
        );
        expect(part(container, "node", "b").style.transform).toBe(
            "translate(205px, 100px)",
        );
    });
});

/** A node with a vertical resizer and the app's handles, their direction and variant bound. */
@Component({
    selector: "test-resize-handle-look",
    imports: [FLOW, FLOW_RESIZE],
    template: `
        <div flowRoot [features]="features" [defaultNodes]="nodes" [defaultViewport]="{ x: 0, y: 0, zoom: 1 }">
            <div flowViewport>
                <div flowNodes>
                    <div *flowNodesItem="let node" [flowNode]="node">
                        <div flowNodeResizer direction="vertical">
                            <div flowResizeHandle position="right" variant="line"></div>
                            <div flowResizeHandle position="top-left" variant="line"></div>
                            <div flowResizeHandle position="bottom-right" [direction]="cornerDirection()"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
})
class ResizeHandleLook {
    readonly cornerDirection = input<"horizontal" | "vertical" | undefined>(
        "horizontal",
    );
    readonly features = [resize()];
    readonly nodes: FlowNode[] = [task("a")];
}

describe("[flowResizeHandle] direction and variant", () => {
    it("gives data-direction and data-variant, a corner's line ignored", async () => {
        const { container } = await render(ResizeHandleLook);
        const at = (position: string) =>
            container.querySelector(
                `[data-position="${position}"]`,
            ) as HTMLElement;
        expect(at("right").getAttribute("data-variant")).toBe("line");
        expect(at("right").hasAttribute("data-direction")).toBe(false);
        expect(at("top-left").getAttribute("data-variant")).toBe("handle");
        expect(at("bottom-right").getAttribute("data-variant")).toBe("handle");
        expect(at("bottom-right").getAttribute("data-direction")).toBe(
            "horizontal",
        );
    });

    it("moves only its own direction's sides, over the resizer's", async () => {
        const { container } = await render(ResizeHandleLook);
        const corner = container.querySelector(
            '[data-position="bottom-right"]',
        ) as HTMLElement;
        await drag(corner, part(container, "root"), [
            { clientX: 100, clientY: 40 },
            { clientX: 130, clientY: 70 },
        ]);
        await settle();
        const node = part(container, "node", "a");
        expect(node.style.width).toBe("130px");
        expect(node.style.height).toBe("40px");
    });
});
