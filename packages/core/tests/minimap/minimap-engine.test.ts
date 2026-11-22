// @vitest-environment jsdom
// The minimap feature's engine side: its geometry (nodes, the view, the mask, a view box fitted to
// its aspect), a press or drag that centres the view on the pressed point, and the wheel's zoom.
import { afterEach, describe, expect, it } from "vitest";
import { minimap } from "../../src/minimap/minimap";
import { flowOf, mount, pointer, unmountAll, wheel } from "../engine/harness";

afterEach(unmountAll);

const sizes = { a: [100, 50], b: [100, 50] } as Record<
    string,
    [number, number]
>;
const json = () => flowOf({ a: [0, 0], b: [300, 200] });

/** A minimap element in the root, at client (600, 450), 200 × 150. */
function minimapElement(root: HTMLElement): HTMLElement {
    const element = document.createElement("div");
    element.setAttribute("data-flow-part", "minimap");
    element.getBoundingClientRect = () =>
        ({
            left: 600,
            top: 450,
            width: 200,
            height: 150,
            right: 800,
            bottom: 600,
            x: 600,
            y: 450,
        }) as DOMRect;
    const node = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    node.setAttribute("data-flow-part", "minimap-node");
    element.append(node);
    root.append(element);
    return element;
}

describe("the minimap", () => {
    it("fits the nodes and the view to its aspect, with the mask around the view", () => {
        const { engine } = mount(json(), { features: [minimap()], sizes });
        expect(engine.get("minimap-view", { width: 200, height: 150 })).toEqual(
            {
                viewBox: { x: -100, y: -75, width: 1000, height: 750 },
                viewBoxAttribute: "-100 -75 1000 750",
                scale: 5,
                nodes: [
                    { nodeId: "a", x: 0, y: 0, width: 100, height: 50 },
                    { nodeId: "b", x: 300, y: 200, width: 100, height: 50 },
                ],
                view: { x: 0, y: 0, width: 800, height: 600 },
                maskPath:
                    "M-100,-75 L900,-75 L900,675 L-100,675 Z M0,0 L800,0 L800,600 L0,600 Z",
            },
        );
        engine.run("set-viewport", { x: -1000, y: 0, zoom: 2 });
        const zoomed = engine.get("minimap-view", { width: 100, height: 100 });
        expect(zoomed.view).toEqual({ x: 500, y: 0, width: 400, height: 300 });
        // the nodes and the view: (0, 0) to (900, 300), in 80% of a square
        expect(zoomed.viewBox).toEqual({
            x: -112.5,
            y: -412.5,
            width: 1125,
            height: 1125,
        });
    });

    it("centres the view on a pressed point and follows a drag", () => {
        const flow = mount(json(), { features: [minimap()], sizes });
        const element = minimapElement(flow.root);
        const node = element.firstElementChild as Element;
        pointer(node, "pointerdown", { clientX: 650, clientY: 525 });
        expect(flow.root.setPointerCapture).toHaveBeenCalledWith(1);
        // a quarter across: flow x -100 + 1000 / 4 = 150
        expect(flow.engine.get("viewport")).toEqual({ x: 250, y: 0, zoom: 1 });
        pointer(flow.root, "pointermove", { clientX: 670, clientY: 525 });
        expect(flow.engine.get("viewport")).toEqual({ x: 150, y: 0, zoom: 1 });
        pointer(flow.root, "pointercancel", { clientX: 670, clientY: 525 });
        expect(flow.engine.get("viewport")).toEqual({ x: 0, y: 0, zoom: 1 });
    });

    it("zooms the flow around the root's centre with the wheel", () => {
        const flow = mount(json(), { features: [minimap()], sizes });
        const element = minimapElement(flow.root);
        const event = wheel(element, {
            deltaY: -100,
            clientX: 700,
            clientY: 500,
        });
        expect(event.defaultPrevented).toBe(true);
        const viewport = flow.engine.get("viewport");
        expect(viewport.zoom).toBeCloseTo(Math.exp(100 / 600));
        expect(viewport.x).toBeCloseTo(400 - 400 * Math.exp(100 / 600));
    });

    it("does nothing when neither pannable nor zoomable", () => {
        const flow = mount(json(), {
            features: [minimap({ pannable: false, zoomable: false })],
            sizes,
        });
        const element = minimapElement(flow.root);
        pointer(element, "pointerdown", { clientX: 650, clientY: 525 });
        pointer(flow.root, "pointermove", { clientX: 700, clientY: 525 });
        pointer(flow.root, "pointerup", { clientX: 700, clientY: 525 });
        wheel(element, { deltaY: -100, clientX: 700, clientY: 500 });
        expect(flow.engine.get("viewport")).toEqual({ x: 0, y: 0, zoom: 1 });
    });

    it("maps a client point on the minimap to a flow point", () => {
        const flow = mount(json(), { features: [minimap()], sizes });
        expect(
            flow.engine.get("minimap-point-to-flow", {
                client: { x: 650, y: 525 },
            }),
        ).toBeUndefined();
        minimapElement(flow.root);
        // the view box (-100, -75) 1000 × 750 over 200 × 150 pixels: 5 units a pixel
        expect(
            flow.engine.get("minimap-point-to-flow", {
                client: { x: 650, y: 525 },
            }),
        ).toEqual({ x: 150, y: 300 });
        expect(
            flow.engine.get("minimap-point-to-flow", {
                client: { x: 600, y: 450 },
            }),
        ).toEqual({ x: -100, y: -75 });
    });

    it("moves the view the other way with inversePan, without centring on the press", () => {
        const flow = mount(json(), {
            features: [minimap({ inversePan: true })],
            sizes,
        });
        const element = minimapElement(flow.root);
        pointer(element, "pointerdown", { clientX: 650, clientY: 525 });
        expect(flow.engine.get("viewport")).toEqual({ x: 0, y: 0, zoom: 1 });
        // 20 pixels right: 100 flow units, the view goes 100 left (10 up: 50 down)
        pointer(flow.root, "pointermove", { clientX: 670, clientY: 525 });
        expect(flow.engine.get("viewport")).toEqual({ x: 100, y: 0, zoom: 1 });
        pointer(flow.root, "pointermove", { clientX: 650, clientY: 515 });
        expect(flow.engine.get("viewport")).toEqual({ x: 0, y: -50, zoom: 1 });
        pointer(flow.root, "pointerup", { clientX: 650, clientY: 515 });
        expect(flow.engine.get("viewport")).toEqual({ x: 0, y: -50, zoom: 1 });
    });

    it("zooms by zoomStep: 20 zooms twice as fast as the default 10", () => {
        const flow = mount(json(), {
            features: [minimap({ zoomStep: 20 })],
            sizes,
        });
        const element = minimapElement(flow.root);
        wheel(element, { deltaY: -100, clientX: 700, clientY: 500 });
        expect(flow.engine.get("viewport").zoom).toBeCloseTo(
            Math.exp(200 / 600),
        );
        expect(minimap().options).toMatchObject({
            inversePan: false,
            zoomStep: 10,
        });
    });

    it("takes a minimap part's inversePan and zoomStep over the feature's, until it clears them", () => {
        const flow = mount(json(), { features: [minimap()], sizes });
        const element = minimapElement(flow.root);
        flow.engine.adapter.setPartOptions("minimap", "", {
            inversePan: true,
            zoomStep: 30,
        });
        pointer(element, "pointerdown", { clientX: 650, clientY: 525 });
        expect(flow.engine.get("viewport")).toEqual({ x: 0, y: 0, zoom: 1 });
        pointer(flow.root, "pointermove", { clientX: 660, clientY: 525 });
        expect(flow.engine.get("viewport")).toEqual({ x: 50, y: 0, zoom: 1 });
        pointer(flow.root, "pointerup", { clientX: 660, clientY: 525 });
        wheel(element, { deltaY: -50, clientX: 700, clientY: 500 });
        expect(flow.engine.get("viewport").zoom).toBeCloseTo(
            Math.exp(150 / 600),
        );
        flow.engine.adapter.setPartOptions("minimap", "", null);
        const before = flow.engine.get("viewport").zoom;
        wheel(element, { deltaY: -50, clientX: 700, clientY: 500 });
        expect(flow.engine.get("viewport").zoom / before).toBeCloseTo(
            Math.exp(50 / 600),
        );
    });

    it("tells a tap on it as minimap-click with the flow point under it, pannable or not", () => {
        for (const pannable of [true, false]) {
            const flow = mount(json(), {
                features: [minimap({ pannable })],
                sizes,
            });
            const element = minimapElement(flow.root);
            const events: unknown[] = [];
            flow.engine.subscribe((event) => {
                if (event.type === "minimap-click") {
                    events.push({ point: event.point, client: event.client });
                }
            });
            pointer(element, "pointerdown", { clientX: 650, clientY: 525 });
            pointer(flow.root, "pointerup", { clientX: 651, clientY: 525 });
            // the view box at the press: (-100, -75), 5 units a pixel
            expect(events, `pannable ${pannable}`).toEqual([
                { point: { x: 155, y: 300 }, client: { x: 651, y: 525 } },
            ]);
            // a drag is no click
            pointer(element, "pointerdown", { clientX: 650, clientY: 525 });
            pointer(flow.root, "pointermove", { clientX: 690, clientY: 525 });
            pointer(flow.root, "pointerup", { clientX: 690, clientY: 525 });
            expect(events).toHaveLength(1);
            unmountAll();
        }
    });
});
