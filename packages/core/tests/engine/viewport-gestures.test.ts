// @vitest-environment jsdom
// The viewport's gestures (D10): a drag on the pane pans (pointer capture on the root), the wheel
// zooms around the pointer (or pans), a two-finger touch pinch zooms and pans, a double click zooms
// in; a cancelled pan (Escape, pointercancel, a lost capture) puts the viewport back.
import { afterEach, describe, expect, it } from "vitest";
import { toFlow } from "../../src/geometry/viewport-math";
import { flowOf, key, mount, pointer, unmountAll, wheel } from "./harness";

afterEach(unmountAll);

describe("panning", () => {
    it("pans by a drag on the pane, capturing the pointer", () => {
        const { engine, root, captured, events } = mount(flowOf({}));
        pointer(root, "pointerdown", { clientX: 100, clientY: 100 });
        expect(root.setPointerCapture).toHaveBeenCalledWith(1);
        pointer(root, "pointermove", { clientX: 150, clientY: 120 });
        expect(engine.is("panning")).toBe(true);
        expect(engine.adapter.attributes("root")["data-panning"]).toBe("");
        pointer(root, "pointermove", { clientX: 130, clientY: 90 });
        pointer(root, "pointerup", { clientX: 130, clientY: 90 });
        expect(engine.get("viewport")).toEqual({ x: 30, y: -10, zoom: 1 });
        expect(engine.is("panning")).toBe(false);
        expect(captured.size).toBe(0);
        expect(events.at(-1)).toEqual({
            type: "viewport-change",
            viewport: { x: 30, y: -10, zoom: 1 },
            gesture: true,
        });
    });

    it("does not pan from a node, a secondary button or with panOnDrag off", () => {
        const { engine, root, node } = mount(flowOf({ a: [0, 0] }), {
            sizes: { a: [50, 50] },
        });
        pointer(node("a"), "pointerdown", { clientX: 10, clientY: 10 });
        pointer(root, "pointermove", { clientX: 60, clientY: 10 });
        pointer(root, "pointerup", { clientX: 60, clientY: 10 });
        pointer(root, "pointerdown", { clientX: 10, clientY: 10, button: 2 });
        pointer(root, "pointermove", { clientX: 60, clientY: 10, button: 2 });
        pointer(root, "pointerup", { clientX: 60, clientY: 10, button: 2 });
        expect(engine.get("viewport")).toEqual({ x: 0, y: 0, zoom: 1 });
        unmountAll();
        const off = mount(flowOf({}), { engine: { panOnDrag: false } });
        pointer(off.root, "pointerdown", { clientX: 0, clientY: 0 });
        pointer(off.root, "pointermove", { clientX: 40, clientY: 0 });
        expect(off.engine.get("viewport").x).toBe(0);
    });

    it.each([
        ["Escape", (root: HTMLElement) => key(root, "Escape")],
        [
            "pointercancel",
            (root: HTMLElement) => pointer(root, "pointercancel"),
        ],
        [
            "a lost capture",
            (root: HTMLElement) => pointer(root, "lostpointercapture"),
        ],
    ])("puts the viewport back when %s cancels a pan", (_name, cancel) => {
        const { engine, root } = mount(flowOf({}));
        pointer(root, "pointerdown", { clientX: 0, clientY: 0 });
        pointer(root, "pointermove", { clientX: 40, clientY: 30 });
        expect(engine.get("viewport").x).toBe(40);
        cancel(root);
        expect(engine.get("viewport")).toEqual({ x: 0, y: 0, zoom: 1 });
        pointer(root, "pointermove", { clientX: 80, clientY: 30 });
        expect(engine.get("viewport").x).toBe(0);
    });

    it("cancels a pan with the cancel-gesture action", () => {
        const { engine, root } = mount(flowOf({}));
        pointer(root, "pointerdown", { clientX: 0, clientY: 0 });
        pointer(root, "pointermove", { clientX: 40, clientY: 30 });
        expect(engine.run("cancel-gesture", {}).ok).toBe(true);
        expect(engine.get("viewport").x).toBe(0);
    });
});

describe("the wheel", () => {
    it("zooms around the pointer", () => {
        const { engine, root } = mount(flowOf({}), {
            root: { left: 50, top: 50, width: 800, height: 600 },
        });
        const event = wheel(root, { deltaY: -100, clientX: 150, clientY: 250 });
        expect(event.defaultPrevented).toBe(true);
        const viewport = engine.get("viewport");
        expect(viewport.zoom).toBeCloseTo(2 ** 0.2);
        // the flow point under the pointer stays under it
        const under = toFlow(viewport, { x: 100, y: 200 });
        expect(under.x).toBeCloseTo(100);
        expect(under.y).toBeCloseTo(200);
    });

    it("stops at the zoom limits and reads lines", () => {
        const { engine, root } = mount(flowOf({}), {
            engine: { minZoom: 0.25, maxZoom: 3 },
        });
        wheel(root, { deltaY: -10_000 });
        expect(engine.get("viewport").zoom).toBe(3);
        wheel(root, { deltaY: 10_000 });
        expect(engine.get("viewport").zoom).toBe(0.25);
        wheel(root, { deltaY: -25, deltaMode: 1 });
        expect(engine.get("viewport").zoom).toBeCloseTo(0.25 * 2 ** 0.8);
    });

    it("zooms faster for a trackpad pinch (Ctrl + wheel)", () => {
        const { engine, root } = mount(flowOf({}));
        wheel(root, { deltaY: -10, ctrlKey: true });
        expect(engine.get("viewport").zoom).toBeCloseTo(2 ** 0.1);
    });

    it("pans with panOnScroll, Shift turning it sideways", () => {
        const { engine, root } = mount(flowOf({}), {
            engine: { panOnScroll: true },
        });
        wheel(root, { deltaX: 10, deltaY: 20 });
        expect(engine.get("viewport")).toEqual({ x: -10, y: -20, zoom: 1 });
        wheel(root, { deltaY: 30, shiftKey: true });
        expect(engine.get("viewport")).toEqual({ x: -40, y: -20, zoom: 1 });
        wheel(root, { deltaY: -10, ctrlKey: true });
        expect(engine.get("viewport").zoom).toBeCloseTo(2 ** 0.1);
    });

    it("leaves a no-wheel subtree and zoomOnScroll off alone", () => {
        const { engine, node } = mount(flowOf({ a: [0, 0] }));
        const scroller = document.createElement("div");
        scroller.setAttribute("data-flow-no-wheel", "");
        node("a").append(scroller);
        const event = wheel(scroller, { deltaY: -100 });
        expect(event.defaultPrevented).toBe(false);
        expect(engine.get("viewport").zoom).toBe(1);
        unmountAll();
        const off = mount(flowOf({}), { engine: { zoomOnScroll: false } });
        wheel(off.root, { deltaY: -100 });
        expect(off.engine.get("viewport").zoom).toBe(1);
    });
});

describe("a touch pinch", () => {
    it("zooms with the fingers' spread and pans with their middle", () => {
        const { engine, root, captured } = mount(flowOf({}), {
            engine: { maxZoom: 4 },
        });
        const touch = { pointerType: "touch" };
        pointer(root, "pointerdown", {
            ...touch,
            pointerId: 1,
            clientX: 100,
            clientY: 100,
        });
        pointer(root, "pointerdown", {
            ...touch,
            pointerId: 2,
            isPrimary: false,
            clientX: 200,
            clientY: 100,
        });
        expect(captured).toEqual(new Set([1, 2]));
        expect(engine.is("panning")).toBe(true);
        pointer(root, "pointermove", {
            ...touch,
            pointerId: 2,
            isPrimary: false,
            clientX: 300,
            clientY: 100,
        });
        // spread 100 → 200: zoom 2; the middle went from (150, 100) to (200, 100)
        expect(engine.get("viewport")).toEqual({ x: -100, y: -100, zoom: 2 });
        pointer(root, "pointerup", {
            ...touch,
            pointerId: 1,
            clientX: 100,
            clientY: 100,
        });
        expect(engine.is("panning")).toBe(false);
        // the finger left behind does nothing
        pointer(root, "pointermove", {
            ...touch,
            pointerId: 2,
            isPrimary: false,
            clientX: 400,
            clientY: 100,
        });
        expect(engine.get("viewport")).toEqual({ x: -100, y: -100, zoom: 2 });
    });

    it("stops at the greatest zoom and ends on pointercancel", () => {
        const { engine, root } = mount(flowOf({}));
        const touch = { pointerType: "touch" };
        pointer(root, "pointerdown", {
            ...touch,
            pointerId: 1,
            clientX: 0,
            clientY: 0,
        });
        pointer(root, "pointerdown", {
            ...touch,
            pointerId: 2,
            isPrimary: false,
            clientX: 10,
            clientY: 0,
        });
        pointer(root, "pointermove", {
            ...touch,
            pointerId: 2,
            isPrimary: false,
            clientX: 500,
            clientY: 0,
        });
        expect(engine.get("viewport").zoom).toBe(2);
        pointer(root, "pointercancel", {
            ...touch,
            pointerId: 2,
            isPrimary: false,
        });
        expect(engine.is("panning")).toBe(false);
    });

    it("does not pinch with zoomOnPinch off", () => {
        const { engine, root } = mount(flowOf({}), {
            engine: { zoomOnPinch: false },
        });
        const touch = { pointerType: "touch" };
        pointer(root, "pointerdown", {
            ...touch,
            pointerId: 1,
            clientX: 0,
            clientY: 0,
        });
        pointer(root, "pointerdown", {
            ...touch,
            pointerId: 2,
            isPrimary: false,
            clientX: 10,
        });
        pointer(root, "pointermove", {
            ...touch,
            pointerId: 2,
            isPrimary: false,
            clientX: 50,
        });
        expect(engine.get("viewport").zoom).toBe(1);
    });
});

describe("a double click", () => {
    it("zooms in twice around the pointer on the pane", () => {
        const { engine, root } = mount(flowOf({}));
        root.dispatchEvent(
            new MouseEvent("dblclick", {
                bubbles: true,
                clientX: 100,
                clientY: 100,
            }),
        );
        expect(engine.get("viewport")).toEqual({ x: -100, y: -100, zoom: 2 });
        unmountAll();
        const off = mount(flowOf({}), { engine: { zoomOnDoubleClick: false } });
        off.root.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
        expect(off.engine.get("viewport").zoom).toBe(1);
    });
});
