// @vitest-environment jsdom
// The pan and zoom input options: `panOnDrag` with mouse buttons (a moved middle or right pan
// keeps the context menu out), the pan activation key (Space: a primary drag pans from anywhere,
// nodes included, and starts no other gesture), `panOnScrollMode` and `panOnScrollSpeed`, and the
// zoom activation key that turns scroll panning back into a zoom.
import { afterEach, describe, expect, it } from "vitest";
import { drag } from "../../src/drag/drag";
import { selection } from "../../src/selection/selection";
import { flowOf, mount, pointer, unmountAll, wheel } from "./harness";

afterEach(unmountAll);

const at = (clientX: number, clientY: number) => ({ clientX, clientY });

const contextMenu = (target: EventTarget) => {
    const event = new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        button: 2,
    });
    target.dispatchEvent(event);
    return event;
};

const keyOn = (
    target: EventTarget,
    type: "keydown" | "keyup",
    key: string,
    code = key === " " ? "Space" : key,
) => {
    const event = new KeyboardEvent(type, {
        key,
        code,
        bubbles: true,
        cancelable: true,
    });
    target.dispatchEvent(event);
    return event;
};

describe("panOnDrag with mouse buttons", () => {
    it("pans with the middle and the right buttons given, not the primary", () => {
        const { engine, root } = mount(flowOf({}), {
            engine: { panOnDrag: [1, 2] },
        });
        for (const button of [1, 2]) {
            pointer(root, "pointerdown", { ...at(100, 100), button });
            pointer(root, "pointermove", { ...at(130, 110), button });
            pointer(root, "pointerup", { ...at(130, 110), button });
        }
        expect(engine.get("viewport")).toEqual({ x: 60, y: 20, zoom: 1 });
        pointer(root, "pointerdown", at(100, 100));
        pointer(root, "pointermove", at(150, 100));
        pointer(root, "pointerup", at(150, 100));
        expect(engine.get("viewport")).toEqual({ x: 60, y: 20, zoom: 1 });
        // a button not given does nothing
        engine.adapter.setOptions({ panOnDrag: [0] });
        pointer(root, "pointerdown", { ...at(100, 100), button: 1 });
        pointer(root, "pointermove", { ...at(150, 100), button: 1 });
        expect(engine.get("viewport")).toEqual({ x: 60, y: 20, zoom: 1 });
    });

    it("keeps the context menu out while a right-button pan is pressed, and after one that moved", () => {
        const { engine, root } = mount(flowOf({}), {
            engine: { panOnDrag: [0, 1, 2] },
        });
        // pressed (macOS and Linux open the menu on press): it stays out, so the pan can happen
        pointer(root, "pointerdown", { ...at(100, 100), button: 2 });
        expect(contextMenu(root).defaultPrevented).toBe(true);
        // released in place (Windows opens it on release): the menu opens
        pointer(root, "pointerup", { ...at(100, 100), button: 2 });
        expect(contextMenu(root).defaultPrevented).toBe(false);
        // a moved middle-button pan does not swallow a later (keyboard) context menu
        pointer(root, "pointerdown", { ...at(100, 100), button: 1 });
        pointer(root, "pointermove", { ...at(140, 100), button: 1 });
        pointer(root, "pointerup", { ...at(140, 100), button: 1 });
        expect(contextMenu(root).defaultPrevented).toBe(false);
        // without the right button in panOnDrag, its menu is the page's
        engine.adapter.setOptions({ panOnDrag: [0] });
        pointer(root, "pointerdown", { ...at(100, 100), button: 2 });
        expect(contextMenu(root).defaultPrevented).toBe(false);
        pointer(root, "pointerup", { ...at(100, 100), button: 2 });
        engine.adapter.setOptions({ panOnDrag: [0, 2] });
        // moved: neither during the pan nor after its release
        pointer(root, "pointerdown", { ...at(100, 100), button: 2 });
        pointer(root, "pointermove", { ...at(140, 100), button: 2 });
        expect(engine.is("panning")).toBe(true);
        expect(contextMenu(root).defaultPrevented).toBe(true);
        pointer(root, "pointerup", { ...at(140, 100), button: 2 });
        expect(contextMenu(root).defaultPrevented).toBe(true);
        // once only
        expect(contextMenu(root).defaultPrevented).toBe(false);
    });

    it("a right-button press does not select, nor a non-primary pan start a feature's gesture", () => {
        const flow = mount(flowOf({ a: [0, 0] }), {
            features: [selection(), drag()],
            sizes: { a: [100, 50] },
            engine: { panOnDrag: [0, 1, 2] },
        });
        flow.model.run("selection.set", { nodeIds: ["a"] });
        pointer(flow.root, "pointerdown", { ...at(400, 400), button: 2 });
        pointer(flow.root, "pointerup", { ...at(400, 400), button: 2 });
        expect(flow.model.get("selected-nodes")).toHaveLength(1);
        // over a node, a middle press neither drags it nor pans
        pointer(flow.node("a"), "pointerdown", { ...at(10, 10), button: 1 });
        pointer(flow.root, "pointermove", { ...at(60, 10), button: 1 });
        pointer(flow.root, "pointerup", { ...at(60, 10), button: 1 });
        expect(flow.model.get("node-by", { id: "a" })?.position).toEqual({
            x: 0,
            y: 0,
        });
        expect(flow.engine.get("viewport")).toEqual({ x: 0, y: 0, zoom: 1 });
    });
});

describe("the pan activation key", () => {
    const flowWithNode = (options = {}) =>
        mount(flowOf({ a: [0, 0] }), {
            features: [selection({ boxOnDrag: true }), drag()],
            sizes: { a: [100, 50] },
            engine: options,
        });

    it("held, a primary drag over a node pans and does not drag it", () => {
        const flow = flowWithNode();
        keyOn(document, "keydown", " ");
        pointer(flow.node("a"), "pointerdown", at(10, 10));
        pointer(flow.root, "pointermove", at(60, 30));
        expect(flow.engine.is("panning")).toBe(true);
        expect(flow.engine.is("dragging")).toBe(false);
        pointer(flow.root, "pointerup", at(60, 30));
        expect(flow.engine.get("viewport")).toEqual({ x: 50, y: 20, zoom: 1 });
        expect(flow.model.get("node-by", { id: "a" })?.position).toEqual({
            x: 0,
            y: 0,
        });
        // on the pane it pans rather than drawing a box, and with panOnDrag off too
        flow.engine.adapter.setOptions({ panOnDrag: false });
        pointer(flow.root, "pointerdown", at(400, 400));
        pointer(flow.root, "pointermove", at(420, 400));
        expect(flow.engine.is("box-selecting")).toBe(false);
        pointer(flow.root, "pointerup", at(420, 400));
        expect(flow.engine.get("viewport").x).toBe(70);
        // a click with the key held pans (by nothing) and does not select the node
        flow.model.run("selection.clear", {});
        pointer(flow.node("a"), "pointerdown", flow.client(10, 10));
        pointer(flow.root, "pointerup", flow.client(10, 10));
        expect(flow.model.get("selected-nodes")).toHaveLength(0);
        // released: a drag drags the node again
        keyOn(document, "keyup", " ");
        pointer(flow.node("a"), "pointerdown", flow.client(10, 10));
        pointer(flow.root, "pointermove", flow.client(40, 10));
        expect(flow.engine.is("dragging")).toBe(true);
    });

    it("ignores the key typed into a field, and forgets it when the window blurs", () => {
        const flow = flowWithNode();
        const input = document.createElement("input");
        document.body.append(input);
        keyOn(input, "keydown", " ");
        pointer(flow.node("a"), "pointerdown", at(10, 10));
        pointer(flow.root, "pointermove", at(40, 10));
        expect(flow.engine.is("dragging")).toBe(true);
        pointer(flow.root, "pointerup", at(40, 10));
        keyOn(document, "keydown", " ");
        window.dispatchEvent(new Event("blur"));
        pointer(flow.node("a"), "pointerdown", flow.client(10, 10));
        pointer(flow.root, "pointermove", flow.client(40, 10));
        expect(flow.engine.is("dragging")).toBe(true);
    });

    it("takes another key, a modifier, or none", () => {
        const shift = flowWithNode({ panActivationKey: "Shift" });
        pointer(shift.node("a"), "pointerdown", {
            ...at(10, 10),
            shiftKey: true,
        });
        pointer(shift.root, "pointermove", { ...at(40, 10), shiftKey: true });
        expect(shift.engine.is("panning")).toBe(true);
        unmountAll();
        const none = flowWithNode({ panActivationKey: null });
        keyOn(document, "keydown", " ");
        pointer(none.node("a"), "pointerdown", at(10, 10));
        pointer(none.root, "pointermove", at(40, 10));
        expect(none.engine.is("dragging")).toBe(true);
        keyOn(document, "keyup", " ");
        unmountAll();
        const code = flowWithNode({ panActivationKey: "KeyH" });
        keyOn(document, "keydown", "h", "KeyH");
        pointer(code.node("a"), "pointerdown", at(10, 10));
        pointer(code.root, "pointermove", at(40, 10));
        expect(code.engine.is("panning")).toBe(true);
        keyOn(document, "keyup", "h", "KeyH");
    });

    it("stops listening to the document when the root is detached", () => {
        const flow = flowWithNode();
        flow.engine.adapter.detachRoot();
        keyOn(document, "keydown", " ");
        flow.engine.adapter.attachRoot(flow.root);
        pointer(flow.node("a"), "pointerdown", at(10, 10));
        pointer(flow.root, "pointermove", at(40, 10));
        expect(flow.engine.is("dragging")).toBe(true);
        keyOn(document, "keyup", " ");
    });
});

describe("scroll panning", () => {
    it("keeps one axis with panOnScrollMode", () => {
        const { engine, root } = mount(flowOf({}), {
            engine: { panOnScroll: true, panOnScrollMode: "vertical" },
        });
        wheel(root, { deltaX: 10, deltaY: 20 });
        expect(engine.get("viewport")).toEqual({ x: 0, y: -20, zoom: 1 });
        // Shift does not turn a vertical-only wheel sideways: it still pans vertically
        wheel(root, { deltaY: 30, shiftKey: true });
        expect(engine.get("viewport")).toEqual({ x: 0, y: -50, zoom: 1 });
        engine.adapter.setOptions({ panOnScrollMode: "horizontal" });
        wheel(root, { deltaX: 10, deltaY: 20 });
        expect(engine.get("viewport")).toEqual({ x: -10, y: -50, zoom: 1 });
        wheel(root, { deltaY: 30, shiftKey: true });
        expect(engine.get("viewport")).toEqual({ x: -40, y: -50, zoom: 1 });
    });

    it("scales the wheel's pixels by panOnScrollSpeed", () => {
        const { engine, root } = mount(flowOf({}), {
            engine: { panOnScroll: true, panOnScrollSpeed: 0.5 },
        });
        wheel(root, { deltaX: 10, deltaY: 20 });
        expect(engine.get("viewport")).toEqual({ x: -5, y: -10, zoom: 1 });
    });

    it("zooms while the zoom activation key is held", () => {
        const { engine, root } = mount(flowOf({}), {
            engine: { panOnScroll: true, zoomActivationKey: "Alt" },
        });
        wheel(root, { deltaY: -60, altKey: true, clientX: 0, clientY: 0 });
        expect(engine.get("viewport")).toEqual({
            x: 0,
            y: 0,
            zoom: expect.closeTo(Math.exp(60 / 600)),
        });
        wheel(root, { deltaY: 20 });
        expect(engine.get("viewport").y).toBe(-20);
        // a key that is not a modifier is read from the document
        engine.adapter.setOptions({ zoomActivationKey: "z" });
        keyOn(document, "keydown", "z", "KeyZ");
        wheel(root, { deltaY: 60, clientX: 0, clientY: -20 });
        expect(engine.get("viewport").zoom).toBeCloseTo(1);
        keyOn(document, "keyup", "z", "KeyZ");
        // none: Ctrl stays the trackpad's pinch, the rest pans
        engine.adapter.setOptions({ zoomActivationKey: null });
        wheel(root, { deltaY: 20, altKey: true });
        expect(engine.get("viewport").y).toBe(-40);
    });

    it("defaults the zoom key to Meta on Apple platforms and Control elsewhere", () => {
        const agent = window.navigator;
        const platform = Object.getOwnPropertyDescriptor(
            Object.getPrototypeOf(agent),
            "platform",
        );
        const set = (value: string) =>
            Object.defineProperty(agent, "platform", {
                configurable: true,
                get: () => value,
            });
        try {
            set("MacIntel");
            const mac = mount(flowOf({}), { engine: { panOnScroll: true } });
            wheel(mac.root, { deltaY: -60, metaKey: true });
            expect(mac.engine.get("viewport").zoom).toBeGreaterThan(1);
            unmountAll();
            set("Win32");
            const other = mount(flowOf({}), { engine: { panOnScroll: true } });
            wheel(other.root, { deltaY: -60, metaKey: true });
            expect(other.engine.get("viewport")).toEqual({
                x: 0,
                y: 60,
                zoom: 1,
            });
            // Control is held (zoomOnPinch off: only the key zooms)
            other.engine.adapter.setOptions({ zoomOnPinch: false });
            wheel(other.root, { deltaY: -60, ctrlKey: true });
            expect(other.engine.get("viewport").zoom).toBeGreaterThan(1);
        } finally {
            delete (agent as { platform?: string }).platform;
            if (platform)
                expect(agent.platform).toBe(platform.get?.call(agent));
        }
    });

    it("without panOnScroll the wheel zooms as before, the key or not", () => {
        const { engine, root } = mount(flowOf({}), {
            engine: { zoomActivationKey: "Alt" },
        });
        wheel(root, { deltaY: -60, clientX: 0, clientY: 0 });
        expect(engine.get("viewport").zoom).toBeCloseTo(Math.exp(60 / 600));
    });
});
