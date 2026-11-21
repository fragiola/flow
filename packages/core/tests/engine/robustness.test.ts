// @vitest-environment jsdom
// What a real browser does that a happy path does not: a release missed outside the root, a
// refused capture, a stale touch, a second finger on a node, the wheel over a control, the root's
// touch-action, and options changing while the engine runs.
import { afterEach, describe, expect, it, vi } from "vitest";
import { drag } from "../../src/drag/drag";
import { flowOf, mount, pointer, unmountAll, wheel } from "./harness";

afterEach(unmountAll);

describe("a browser's edge cases", () => {
    it("keeps the browser's touch panning off the root while attached", () => {
        const { root, engine } = mount(flowOf({}));
        expect(root.style.getPropertyValue("touch-action")).toBe("none");
        engine.adapter.detachRoot();
        expect(root.style.getPropertyValue("touch-action")).toBe("");
    });

    it("ends a press whose release was missed where its pointer was last seen", () => {
        const flow = mount(flowOf({ a: [0, 0] }), {
            features: [drag()],
            sizes: { a: [100, 50] },
        });
        flow.root.setPointerCapture = vi.fn(() => {
            throw new DOMException("no active pointer", "InvalidStateError");
        });
        pointer(flow.node("a"), "pointerdown", { clientX: 10, clientY: 10 });
        pointer(flow.root, "pointermove", { clientX: 40, clientY: 10 });
        // the release happened outside the root: the next press ends the drag there
        pointer(flow.root, "pointerdown", { clientX: 300, clientY: 300 });
        expect(flow.model.get("node-by", { id: "a" })?.position).toEqual({
            x: 30,
            y: 0,
        });
        expect(flow.commits.at(-1)?.transient).toBe(false);
        expect(flow.engine.is("dragging")).toBe(false);
        // and the new press pans
        pointer(flow.root, "pointermove", { clientX: 310, clientY: 300 });
        pointer(flow.root, "pointerup", { clientX: 310, clientY: 300 });
        expect(flow.engine.get("viewport").x).toBe(10);
    });

    it("forgets a touch on a control and one whose capture was lost, so a pinch still works", () => {
        const { root, engine, node } = mount(flowOf({ a: [0, 0] }), {
            sizes: { a: [100, 50] },
        });
        const touch = { pointerType: "touch" };
        const button = document.createElement("button");
        node("a").append(button);
        pointer(button, "pointerdown", {
            ...touch,
            pointerId: 7,
            clientX: 5,
            clientY: 5,
        });
        pointer(root, "pointerdown", {
            ...touch,
            pointerId: 8,
            clientX: 500,
            clientY: 500,
        });
        pointer(root, "lostpointercapture", { ...touch, pointerId: 8 });
        pointer(root, "pointerdown", {
            ...touch,
            pointerId: 1,
            clientX: 400,
            clientY: 300,
        });
        pointer(root, "pointerdown", {
            ...touch,
            pointerId: 2,
            isPrimary: false,
            clientX: 500,
            clientY: 300,
        });
        expect(engine.is("panning")).toBe(true);
        pointer(root, "pointermove", {
            ...touch,
            pointerId: 2,
            isPrimary: false,
            clientX: 550,
            clientY: 300,
        });
        expect(engine.get("viewport").zoom).toBeCloseTo(1.5);
    });

    it("pinches when a second finger lands on a node before its drag starts", () => {
        const flow = mount(flowOf({ a: [0, 0] }), {
            features: [drag({ threshold: 10 })],
            sizes: { a: [100, 50] },
        });
        const touch = { pointerType: "touch" };
        pointer(flow.node("a"), "pointerdown", {
            ...touch,
            pointerId: 1,
            clientX: 50,
            clientY: 25,
        });
        pointer(flow.root, "pointerdown", {
            ...touch,
            pointerId: 2,
            isPrimary: false,
            clientX: 150,
            clientY: 25,
        });
        pointer(flow.root, "pointermove", {
            ...touch,
            pointerId: 2,
            isPrimary: false,
            clientX: 250,
            clientY: 25,
        });
        expect(flow.engine.get("viewport").zoom).toBe(2);
        expect(flow.model.get("node-by", { id: "a" })?.position).toEqual({
            x: 0,
            y: 0,
        });
        expect(flow.commits).toEqual([]);
    });

    it("leaves the wheel over a control or a panel alone", () => {
        const { root, engine } = mount(flowOf({}));
        const controls = document.createElement("div");
        controls.setAttribute("data-flow-part", "controls");
        root.append(controls);
        expect(wheel(controls, { deltaY: -100 }).defaultPrevented).toBe(false);
        expect(engine.get("viewport").zoom).toBe(1);
    });

    it("follows options changed while it runs", () => {
        const { root, engine } = mount(flowOf({}));
        engine.run("zoom-to", { zoom: 2 });
        engine.adapter.setOptions({
            maxZoom: 1.5,
            panOnDrag: false,
            onlyRenderVisible: true,
        });
        expect(engine.get("viewport").zoom).toBe(1.5);
        expect(engine.adapter.settings.onlyRenderVisible).toBe(true);
        const { x } = engine.get("viewport");
        pointer(root, "pointerdown", { clientX: 0, clientY: 0 });
        pointer(root, "pointermove", { clientX: 50, clientY: 0 });
        pointer(root, "pointerup", { clientX: 50, clientY: 0 });
        expect(engine.get("viewport").x).toBe(x);
        engine.adapter.setOptions({ interactive: false });
        expect(engine.is("interactive")).toBe(false);
    });
});
