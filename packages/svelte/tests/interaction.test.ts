// The interaction options and gesture events of #33 in Svelte: the new engine options and
// `defaultEdgeOptions` as root props, one lowercase callback per engine event
// (`ENGINE_EVENT_CALLBACKS`: `onnodeclick`, `onmovestart`, …), `Handle`'s `connectableStart` /
// `connectableEnd`, the Controls' lock switching dragging, connecting and selecting, and a
// reconnect anchor drawn only at an end that may move.
import { ENGINE_EVENT_CALLBACKS } from "@fragiola/flow";
import { drag as dragFeature } from "@fragiola/flow/drag";
import { selection } from "@fragiola/flow/selection";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFlowRef, type RootProps } from "../src/index";
import ControlsFlow from "./fixtures/controls-flow.svelte";
import HandlesFlow from "./fixtures/handles-flow.svelte";
import TestFlow from "./fixtures/test-flow.svelte";
import { click, drag, installLayout, part, render, settle, task } from "./flow";

beforeEach(installLayout);

describe("the root's event callbacks", () => {
    it("has one per engine event, named from the core's table in lowercase", () => {
        const names = Object.values(ENGINE_EVENT_CALLBACKS).map(
            (name) => `on${name.toLowerCase()}`,
        );
        expect(names).toContain("onnodeclick");
        expect(names).toContain("onmovestart");
        expect(names).toContain("oninit");
        expect(names).toContain("onconnectcancel");
        expect(names).toContain("onresizeend");
        expect(names).toContain("ondelete");
        // every name is a prop of the root (a type error otherwise)
        const props: Required<
            Pick<RootProps, "onnodeclick" | "onmoveend" | "onconnectcancel">
        > = {
            onnodeclick: () => {},
            onmoveend: () => {},
            onconnectcancel: () => {},
        };
        expect(Object.keys(props)).toHaveLength(3);
    });

    it("calls the latest callback with the event, and puts none on the element", async () => {
        const first = vi.fn();
        const second = vi.fn();
        const oninit = vi.fn();
        const onpaneclick = vi.fn();
        const onmovestart = vi.fn();
        const onmoveend = vi.fn();
        const { container, rerender } = await render(TestFlow, {
            defaultNodes: [task("a", 0, 0)],
            features: [selection()],
            onnodeclick: first,
            oninit,
        });
        expect(oninit).toHaveBeenCalledWith({ type: "ready" });
        await rerender({
            onnodeclick: second,
            onpaneclick,
            onmovestart,
            onmoveend,
        });
        const root = part(container, "root");
        expect(root.getAttribute("onnodeclick")).toBeNull();
        // not a listener of an element event either
        root.dispatchEvent(new CustomEvent("nodeclick", { bubbles: true }));
        root.dispatchEvent(new CustomEvent("paneclick", { bubbles: true }));
        expect(second).not.toHaveBeenCalled();
        expect(onpaneclick).not.toHaveBeenCalled();
        await drag(part(container, "node", "a"), root, [
            { clientX: 10, clientY: 10 },
        ]);
        expect(first).not.toHaveBeenCalled();
        expect(second).toHaveBeenCalledWith(
            expect.objectContaining({ type: "node-click", nodeId: "a" }),
        );
        await drag(root, root, [
            { clientX: 500, clientY: 400 },
            { clientX: 540, clientY: 400 },
        ]);
        expect(onpaneclick).not.toHaveBeenCalled();
        expect(onmovestart).toHaveBeenCalledOnce();
        expect(onmoveend).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "viewport-change-end",
                viewport: { x: 40, y: 0, zoom: 1 },
            }),
        );
        await drag(root, root, [{ clientX: 500, clientY: 400 }]);
        expect(onpaneclick).toHaveBeenCalledOnce();
    });
});

describe("the new engine options and defaultEdgeOptions", () => {
    it("reach the engine, and the model the root creates", async () => {
        const ref = createFlowRef();
        const { container, rerender } = await render(TestFlow, {
            flowRef: ref,
            defaultNodes: [task("a"), task("b", 0, 200)],
            defaultEdgeOptions: { type: "step" },
            preventScrolling: false,
            zoomOnScroll: false,
        });
        const root = part(container, "root");
        const wheel = new WheelEvent("wheel", {
            bubbles: true,
            cancelable: true,
            deltaY: 10,
        });
        root.dispatchEvent(wheel);
        expect(wheel.defaultPrevented).toBe(false);
        await rerender({ preventScrolling: undefined });
        const prevented = new WheelEvent("wheel", {
            bubbles: true,
            cancelable: true,
            deltaY: 10,
        });
        root.dispatchEvent(prevented);
        expect(prevented.defaultPrevented).toBe(true);
        ref.current?.model.run("edge.add", { source: "a", target: "b" });
        expect(ref.current?.model.get("all-edges")[0]?.type).toBe("step");
    });

    it("take the tap distances", async () => {
        const onpaneclick = vi.fn();
        const { container } = await render(TestFlow, {
            defaultNodes: [task("a")],
            paneClickDistance: 30,
            onpaneclick,
        });
        const root = part(container, "root");
        await drag(root, root, [
            { clientX: 500, clientY: 400 },
            { clientX: 520, clientY: 400 },
        ]);
        expect(onpaneclick).toHaveBeenCalledOnce();
    });
});

describe("Handle's connectableStart and connectableEnd", () => {
    it("reach the registration and the part attributes", async () => {
        const onconnectstart = vi.fn();
        const { container } = await render(HandlesFlow, {
            start: false,
            end: false,
            onconnectstart,
        });
        const out = part(container, "handle", "out");
        const into = part(container, "handle", "in");
        expect(out.hasAttribute("data-connectable-start")).toBe(false);
        expect(out.hasAttribute("data-connectable-end")).toBe(true);
        expect(into.hasAttribute("data-connectable-end")).toBe(false);
        await drag(out, part(container, "root"), [
            { clientX: 100, clientY: 20 },
            { clientX: 200, clientY: 20 },
        ]);
        expect(onconnectstart).not.toHaveBeenCalled();
    });
});

describe("ReconnectAnchor", () => {
    it("draws only at an end that may move", async () => {
        const { container } = await render(HandlesFlow, {
            reconnectable: "target",
        });
        await settle();
        const ends = [
            ...container.querySelectorAll(
                '[data-flow-part="reconnect-anchor"]',
            ),
        ].map((anchor) => anchor.getAttribute("data-end"));
        expect(ends).toEqual(["target"]);
    });
});

describe("the Controls' lock", () => {
    it("switches dragging, connecting and selecting, React Flow's way", async () => {
        const ref = createFlowRef();
        const { container } = await render(ControlsFlow, {
            flowRef: ref,
            defaultNodes: [task("a")],
            features: [selection(), dragFeature()],
        });
        const button = part(container, "toggle-interactive");
        expect(button.getAttribute("aria-pressed")).toBe("false");
        await click(button);
        const engine = ref.current?.engine;
        expect(engine?.is("interactive-by", { kind: "drag" })).toBe(false);
        expect(engine?.is("interactive-by", { kind: "connect" })).toBe(false);
        expect(engine?.is("interactive-by", { kind: "select" })).toBe(false);
        expect(engine?.is("interactive")).toBe(true);
        expect(button.getAttribute("aria-pressed")).toBe("true");
        // locked: a drag moves nothing
        await drag(part(container, "node", "a"), part(container, "root"), [
            { clientX: 10, clientY: 10 },
            { clientX: 60, clientY: 10 },
        ]);
        expect(ref.current?.model.get("node-by", { id: "a" })?.position.x).toBe(
            0,
        );
        await click(button);
        expect(engine?.is("interactive-by", { kind: "drag" })).toBe(true);
        expect(button.getAttribute("aria-pressed")).toBe("false");
        // a flow locked by `interactive` unlocks whole
        engine?.run("set-interactive", { interactive: false });
        await settle();
        expect(button.getAttribute("aria-pressed")).toBe("true");
        await click(button);
        expect(engine?.is("interactive")).toBe(true);
    });
});
