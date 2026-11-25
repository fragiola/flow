// @vitest-environment jsdom
// Keyboard connections (`keyboard()` with `connection()`, through the host's keyboard links):
// focusable handles, Enter on one starts, Tab / Shift + Tab or the arrows walk the targets the
// model accepts nearest first (a vetoed one skipped), read again on each step (a handle registered
// meanwhile offered, a rule's new veto applied, the one pointed at kept), the node of the one
// pointed at panned into view, Enter connects, Escape cancels, with their events; nothing changes
// for an app without both features.
import { afterEach, describe, expect, it } from "vitest";
import { veto } from "../../src/commands/veto";
import { connection } from "../../src/connection/connection";
import type { FlowEngineEvent } from "../../src/engine/events";
import type { FlowFeatures } from "../../src/features/types";
import { keyboard } from "../../src/keyboard/keyboard";
import { selection } from "../../src/selection/selection";
import type { HandleSpec } from "../engine/harness";
import { flowOf, key, mount, pointer, unmountAll } from "../engine/harness";

afterEach(unmountAll);

// a's source at (100, 25); targets: d's at (150, 130) (≈116 away), b's at (300, 25) (200), c's at
// (300, 225) (≈283); b also has a source handle (never a target in strict mode)
const handles: HandleSpec[] = [
    {
        nodeId: "a",
        handleId: "out",
        type: "source",
        side: "right",
        x: 95,
        y: 20,
    },
    { nodeId: "b", handleId: "in", type: "target", side: "left", x: -5, y: 20 },
    {
        nodeId: "b",
        handleId: "b-out",
        type: "source",
        side: "right",
        x: 95,
        y: 20,
    },
    { nodeId: "c", handleId: "in", type: "target", side: "left", x: -5, y: 20 },
    { nodeId: "d", handleId: "in", type: "target", side: "top", x: 45, y: -5 },
];

function flow<const F extends FlowFeatures>(features: F) {
    return mount(
        flowOf({ a: [0, 0], b: [300, 0], c: [300, 200], d: [100, 130] }),
        {
            features,
            sizes: { a: [100, 50], b: [100, 50], c: [100, 50], d: [100, 50] },
            handles,
        },
    );
}

const both = () => flow([connection(), keyboard()]);

const targetsOf = (events: FlowEngineEvent[]) =>
    events.flatMap((event) =>
        event.type === "connect-target"
            ? [`${event.nodeId}:${event.index}/${event.count}`]
            : [],
    );

const handlePayload = (
    nodeId: string,
    handleId: string,
    type: "source" | "target",
) => ({
    nodeId,
    handleId,
    type,
    side: "left" as const,
});

describe("keyboard connections", () => {
    it("Enter on a focused handle starts, pointing at the nearest valid target", () => {
        const { engine, events, handle } = both();
        const enter = key(handle("a", "source", "out"), "Enter");
        expect(enter.defaultPrevented).toBe(true);
        expect(events).toEqual([
            {
                type: "connect-start",
                nodeId: "a",
                handleId: "out",
                handleType: "source",
                input: "keyboard",
            },
            {
                type: "connect-target",
                nodeId: "d",
                handleId: "in",
                handleType: "target",
                index: 0,
                count: 3,
            },
        ]);
        expect(engine.is("connecting")).toBe(true);
        expect(engine.get("connection")).toMatchObject({
            from: { nodeId: "a", handleId: "out" },
            fromPoint: { x: 100, y: 25 },
            to: { nodeId: "d", handleId: "in" },
            toPoint: { x: 150, y: 130 },
            toSide: "top",
            status: "valid",
        });
        expect(
            engine.adapter.attributes(
                "handle",
                handlePayload("d", "in", "target"),
            )["data-valid"],
        ).toBe("");
        expect(
            engine.adapter.attributes(
                "handle",
                handlePayload("a", "out", "source"),
            )["data-connecting"],
        ).toBe("");
        expect(engine.adapter.attributes("root")["data-connecting"]).toBe("");
    });

    it("Tab, Shift + Tab and the arrows walk the targets round, nearest first", () => {
        const { events, handle } = both();
        const out = handle("a", "source", "out");
        key(out, " ");
        const tab = key(out, "Tab");
        expect(tab.defaultPrevented).toBe(true);
        key(out, "ArrowDown");
        key(out, "ArrowRight");
        key(out, "Tab", { shiftKey: true });
        key(out, "ArrowUp");
        key(out, "ArrowLeft");
        expect(targetsOf(events)).toEqual([
            "d:0/3",
            "b:1/3",
            "c:2/3",
            "d:0/3",
            "c:2/3",
            "b:1/3",
            "d:0/3",
        ]);
    });

    it("Enter connects to the target pointed at (edge.add), one step", () => {
        const { engine, events, model, commits, handle } = both();
        const out = handle("a", "source", "out");
        key(out, "Enter");
        key(out, "Tab");
        const enter = key(out, "Enter");
        expect(enter.defaultPrevented).toBe(true);
        expect(model.get("all-edges")).toEqual([
            {
                id: "edge-1",
                source: "a",
                sourceHandle: "out",
                target: "b",
                targetHandle: "in",
            },
        ]);
        expect(commits.map((commit) => commit.command)).toEqual(["edge.add"]);
        expect(events.at(-1)).toEqual({
            type: "connect",
            edgeId: "edge-1",
            source: "a",
            target: "b",
            input: "keyboard",
        });
        expect(engine.get("connection")).toBeNull();
        expect(engine.is("connecting")).toBe(false);
        // over: the next Enter starts again, a Tab is the page's
        expect(key(out, "Tab").defaultPrevented).toBe(false);
    });

    it("skips a target the model refuses, and cancels when the model takes none", () => {
        const { events, model, handle } = both();
        model.use((ctx, next) =>
            ctx.command === "edge.add" && ctx.payload.target === "d"
                ? veto("not d")
                : next(),
        );
        const out = handle("a", "source", "out");
        key(out, "Enter");
        key(out, "Tab");
        expect(targetsOf(events)).toEqual(["b:0/2", "c:1/2"]);
        key(out, "Escape");
        model.use(() => veto("nothing"));
        events.length = 0;
        key(out, "Enter");
        expect(events).toEqual([
            expect.objectContaining({ type: "connect-start" }),
            {
                type: "connect-target",
                nodeId: undefined,
                handleId: undefined,
                handleType: undefined,
                index: -1,
                count: 0,
            },
        ]);
        key(out, "Enter");
        expect(events.at(-1)).toMatchObject({
            type: "connect-cancel",
            refused: false,
            input: "keyboard",
        });
        expect(model.get("all-edges")).toEqual([]);
    });

    it("a veto that comes after the start refuses the connect", () => {
        const { events, model, handle } = both();
        const out = handle("a", "source", "out");
        key(out, "Enter");
        model.use(() => veto("changed my mind"));
        key(out, "Enter");
        expect(events.at(-1)).toMatchObject({
            type: "connect-cancel",
            refused: true,
            input: "keyboard",
        });
        expect(model.get("all-edges")).toEqual([]);
    });

    it("Escape cancels (with no selection change), as cancel-gesture and a press do", () => {
        const flow = flow3();
        const { engine, events, model, handle } = flow;
        model.run("selection.set", { nodeIds: ["b"] });
        const out = handle("a", "source", "out");
        key(out, "Enter");
        const escaped = key(out, "Escape");
        expect(escaped.defaultPrevented).toBe(true);
        expect(events.at(-1)).toMatchObject({
            type: "connect-cancel",
            refused: false,
            input: "keyboard",
        });
        expect(engine.is("connecting")).toBe(false);
        // Escape went to the connection, not to the selection
        expect(model.get("selected-nodes").map((node) => node.id)).toEqual([
            "b",
        ]);
        key(out, "Enter");
        expect(engine.run("cancel-gesture").ok).toBe(true);
        expect(events.at(-1)?.type).toBe("connect-cancel");
        key(out, "Enter");
        pointer(flow.root, "pointerdown", { clientX: 600, clientY: 500 });
        pointer(flow.root, "pointerup", { clientX: 600, clientY: 500 });
        expect(events.at(-1)?.type).toBe("connect-cancel");
        expect(engine.is("connecting")).toBe(false);
        key(out, "Enter");
        engine.run("set-interactive", { interactive: false });
        expect(engine.is("connecting")).toBe(false);
        expect(model.get("all-edges")).toEqual([]);
    });

    it("starts nothing while not interactive, from a handle not connectable, or with a modifier", () => {
        const { engine, events, model, handle } = both();
        const out = handle("a", "source", "out");
        expect(key(out, "Enter", { ctrlKey: true }).defaultPrevented).toBe(
            false,
        );
        engine.run("set-interactive", { interactive: false });
        key(out, "Enter");
        engine.run("set-interactive", { interactive: true });
        model.run("node.set-flags", { nodeId: "a", connectable: false });
        key(out, "Enter");
        expect(
            events.filter((event) => event.type !== "viewport-change"),
        ).toEqual([]);
        expect(engine.is("connecting")).toBe(false);
    });

    it("pointer connections are told apart: input pointer", () => {
        const { events, handle, root } = both();
        pointer(handle("a", "source", "out"), "pointerdown", {
            clientX: 100,
            clientY: 25,
        });
        pointer(root, "pointermove", { clientX: 295, clientY: 25 });
        pointer(root, "pointerup", { clientX: 295, clientY: 25 });
        expect(events.map((event) => "input" in event && event.input)).toEqual([
            "pointer",
            "pointer",
        ]);
    });
});

/** Both features and the selection. */
function flow3() {
    return flow([selection(), connection(), keyboard()]);
}

describe("handle focusability", () => {
    const tabindexOf = (
        engine: ReturnType<typeof both>["engine"],
        nodeId = "a",
        connectable?: boolean,
    ) =>
        engine.adapter.attributes("handle", {
            nodeId,
            handleId: "out",
            type: "source",
            side: "right",
            ...(connectable === undefined ? {} : { connectable }),
        }).tabindex;

    it("a handle takes focus only with both connection() and keyboard()", () => {
        expect(tabindexOf(both().engine)).toBe("0");
        expect(tabindexOf(flow([connection()]).engine)).toBeUndefined();
        expect(tabindexOf(flow([keyboard()]).engine)).toBeUndefined();
        expect(tabindexOf(flow([]).engine)).toBeUndefined();
        // install order does not matter
        expect(tabindexOf(flow([keyboard(), connection()]).engine)).toBe("0");
    });

    it("not for a handle or a node that is not connectable", () => {
        const { engine, model } = both();
        expect(tabindexOf(engine, "a", false)).toBeUndefined();
        model.run("node.set-flags", { nodeId: "a", connectable: false });
        expect(tabindexOf(engine)).toBeUndefined();
    });

    it("without both, Enter on a handle starts nothing", () => {
        const only = flow([connection()]);
        key(only.handle("a", "source", "out"), "Enter");
        expect(only.events).toEqual([]);
        const keys = flow([selection(), keyboard()]);
        const enter = key(keys.handle("a", "source", "out"), "Enter");
        expect(keys.events).toEqual([]);
        expect(enter.defaultPrevented).toBe(false);
    });
});

describe("a waiting keyboard connection keeps to its handle", () => {
    /** Both features and the selection, a's handle focusable and an input inside a. */
    function focused() {
        const flow = flow3();
        const out = flow.handle("a", "source", "out");
        out.tabIndex = 0;
        const field = document.createElement("input");
        flow.node("a").append(field);
        out.focus();
        return { ...flow, out, field };
    }

    it("ends when focus goes to a field, which then types its keys", () => {
        const { engine, events, model, out, field } = focused();
        key(out, "Enter");
        expect(engine.is("connecting")).toBe(true);
        field.focus();
        expect(events.at(-1)).toMatchObject({
            type: "connect-cancel",
            refused: false,
            input: "keyboard",
        });
        expect(engine.is("connecting")).toBe(false);
        for (const name of [" ", "Enter", "Tab", "ArrowLeft"]) {
            expect(key(field, name).defaultPrevented, name).toBe(false);
        }
        expect(model.get("all-edges")).toEqual([]);
        // the ended gesture is gone: nothing to cancel
        expect(engine.run("cancel-gesture").ok).toBe(false);
    });

    it("takes no key from elsewhere while it waits (a field, a button in the root)", () => {
        const { engine, model, root, out, field } = focused();
        key(out, "Enter");
        // keys dispatched elsewhere without moving focus are still not its own
        expect(key(field, " ").defaultPrevented).toBe(false);
        const controls = document.createElement("div");
        controls.setAttribute("data-flow-part", "controls");
        const button = document.createElement("button");
        controls.append(button);
        root.append(controls);
        expect(key(button, "Enter").defaultPrevented).toBe(false);
        expect(model.get("all-edges")).toEqual([]);
        expect(engine.is("connecting")).toBe(true);
        key(out, "Enter");
        expect(model.get("all-edges")).toHaveLength(1);
    });

    it("cancels when its source node is removed (a delete key)", () => {
        const { engine, events, model, out } = focused();
        model.run("selection.set", { nodeIds: ["a"] });
        key(out, "Enter");
        key(out, "Delete");
        expect(model.get("node-by", { id: "a" })).toBeUndefined();
        expect(events.at(-1)).toEqual({
            type: "remove",
            nodeIds: ["a"],
            edgeIds: [],
        });
        expect(events.at(-2)).toMatchObject({
            type: "connect-cancel",
            refused: false,
            input: "keyboard",
        });
        expect(engine.is("connecting")).toBe(false);
        expect(engine.run("cancel-gesture").ok).toBe(false);
    });

    it("a held Enter's repeats neither start nor connect", () => {
        const { engine, events, model, out } = focused();
        expect(key(out, "Enter", { repeat: true }).defaultPrevented).toBe(
            false,
        );
        expect(events).toEqual([]);
        key(out, "Enter");
        expect(key(out, "Enter", { repeat: true }).defaultPrevented).toBe(true);
        expect(engine.is("connecting")).toBe(true);
        expect(model.get("all-edges")).toEqual([]);
    });

    it("Escape on the page's body cancels it", () => {
        const { engine, events, out } = focused();
        key(out, "Enter");
        key(document.body, "Escape");
        expect(events.at(-1)).toMatchObject({
            type: "connect-cancel",
            input: "keyboard",
        });
        expect(engine.is("connecting")).toBe(false);
    });

    it("Enter on a handle while a click-to-connect connection waits starts nothing", () => {
        const clicks = flow([connection({ clickToConnect: true }), keyboard()]);
        const out = clicks.handle("a", "source", "out");
        pointer(out, "pointerdown", { clientX: 100, clientY: 25 });
        pointer(clicks.root, "pointerup", { clientX: 100, clientY: 25 });
        expect(clicks.events.map((event) => event.type)).toEqual([
            "connect-start",
        ]);
        key(clicks.handle("b", "source", "b-out"), "Enter");
        expect(clicks.events.map((event) => event.type)).toEqual([
            "connect-start",
        ]);
        expect(clicks.engine.get("connection")?.from.nodeId).toBe("a");
        key(out, "Escape");
        expect(clicks.events.at(-1)).toMatchObject({
            type: "connect-cancel",
            input: "pointer",
        });
    });
});

describe("a waiting keyboard connection follows the flow", () => {
    /** A target handle on `nodeId` registered after the mount, its top-left corner at (x, y) in its node. */
    function lateHandle(
        flow: ReturnType<typeof both>,
        nodeId: string,
        handleId: string,
        x: number,
        y: number,
    ) {
        const element = document.createElement("div");
        element.getBoundingClientRect = () => {
            const parent = flow.node(nodeId).getBoundingClientRect();
            const { zoom } = flow.engine.get("viewport");
            return {
                left: parent.left + x * zoom,
                top: parent.top + y * zoom,
                width: 10 * zoom,
                height: 10 * zoom,
                right: parent.left + (x + 10) * zoom,
                bottom: parent.top + (y + 10) * zoom,
                x: parent.left + x * zoom,
                y: parent.top + y * zoom,
                toJSON: () => ({}),
            } as DOMRect;
        };
        flow.node(nodeId).append(element);
        flow.engine.adapter.registerHandle(
            { nodeId, handleId, type: "target", side: "left" },
            element,
        );
    }

    it("offers on the next step a handle registered after it started", () => {
        const flow = both();
        const out = flow.handle("a", "source", "out");
        key(out, "Enter");
        // c's second target at (300, 205): ≈ 269 away, between b's and c's first
        lateHandle(flow, "c", "in-2", -5, 0);
        key(out, "Tab");
        key(out, "Tab");
        key(out, "Tab");
        expect(targetsOf(flow.events)).toEqual([
            "d:0/3",
            "b:1/4",
            "c:2/4",
            "c:3/4",
        ]);
        expect(flow.engine.get("connection")?.to).toMatchObject({
            nodeId: "c",
            handleId: "in",
        });
        key(out, "Tab");
        key(out, "ArrowLeft");
        expect(flow.engine.get("connection")?.to).toMatchObject({
            nodeId: "c",
            handleId: "in",
        });
        key(out, "ArrowLeft");
        key(out, "Enter");
        expect(flow.model.get("all-edges")).toEqual([
            expect.objectContaining({ target: "c", targetHandle: "in-2" }),
        ]);
    });

    it("drops on the next step a target a rule started vetoing, keeping the one pointed at", () => {
        const { events, model, handle } = both();
        const out = handle("a", "source", "out");
        key(out, "Enter");
        model.use((ctx, next) =>
            ctx.command === "edge.add" && ctx.payload.target === "b"
                ? veto("not b")
                : next(),
        );
        key(out, "Tab");
        key(out, "Tab");
        expect(targetsOf(events)).toEqual(["d:0/3", "c:1/2", "d:0/2"]);
    });

    it("points at the one that took its place when the target pointed at goes", () => {
        const { engine, events, model, handle } = both();
        const out = handle("a", "source", "out");
        key(out, "Enter");
        key(out, "Tab");
        let refused = "b";
        model.use((ctx, next) =>
            ctx.command === "edge.add" && ctx.payload.target === refused
                ? veto("refused")
                : next(),
        );
        key(out, "Tab");
        expect(targetsOf(events).at(-1)).toBe("c:1/2");
        key(out, "Tab");
        expect(targetsOf(events).at(-1)).toBe("d:0/2");
        // the one pointed at goes, a step back: the one before its place
        key(out, "Tab");
        refused = "c";
        key(out, "Tab", { shiftKey: true });
        expect(targetsOf(events).at(-1)).toBe("d:0/2");
        // none left: it points nowhere, and Enter connects nothing
        model.use(() => veto("nothing"));
        key(out, "Tab");
        expect(targetsOf(events).at(-1)).toBe("undefined:-1/0");
        expect(engine.get("connection")).toMatchObject({
            to: undefined,
            status: null,
        });
        key(out, "Enter");
        expect(events.at(-1)).toMatchObject({
            type: "connect-cancel",
            refused: false,
        });
        expect(model.get("all-edges")).toEqual([]);
    });

    it("pans the node of the target it points at into view, as a focused node", () => {
        const flow = mount(
            flowOf({ a: [0, 0], near: [200, 0], far: [2000, 1000] }),
            {
                features: [connection(), keyboard()],
                sizes: { a: [100, 50], near: [100, 50], far: [100, 50] },
                handles: [
                    {
                        nodeId: "a",
                        handleId: "out",
                        type: "source",
                        side: "right",
                        x: 95,
                        y: 20,
                    },
                    {
                        nodeId: "near",
                        handleId: "in",
                        type: "target",
                        side: "left",
                        x: -5,
                        y: 20,
                    },
                    {
                        nodeId: "far",
                        handleId: "in",
                        type: "target",
                        side: "left",
                        x: -5,
                        y: 20,
                    },
                ],
            },
        );
        const out = flow.handle("a", "source", "out");
        key(out, "Enter");
        // the nearest one is in view: the viewport stays
        expect(flow.engine.get("viewport")).toEqual({ x: 0, y: 0, zoom: 1 });
        key(out, "Tab");
        // far's centre (2050, 1025) at the root's centre (400, 300)
        expect(flow.engine.get("viewport")).toEqual({
            x: -1650,
            y: -725,
            zoom: 1,
        });
        // back to near, out of view after that pan: its centre (250, 25) at the root's centre
        key(out, "Tab");
        expect(flow.engine.get("viewport")).toEqual({
            x: 150,
            y: 275,
            zoom: 1,
        });
    });

    it("pans nothing with panOnFocus false", () => {
        const flow = mount(flowOf({ a: [0, 0], far: [2000, 1000] }), {
            features: [connection(), keyboard({ panOnFocus: false })],
            sizes: { a: [100, 50], far: [100, 50] },
            handles: [
                {
                    nodeId: "a",
                    handleId: "out",
                    type: "source",
                    side: "right",
                    x: 95,
                    y: 20,
                },
                {
                    nodeId: "far",
                    handleId: "in",
                    type: "target",
                    side: "left",
                    x: -5,
                    y: 20,
                },
            ],
        });
        const out = flow.handle("a", "source", "out");
        key(out, "Enter");
        key(out, "Tab");
        expect(flow.engine.get("connection")?.to?.nodeId).toBe("far");
        expect(flow.engine.get("viewport")).toEqual({ x: 0, y: 0, zoom: 1 });
    });
});
