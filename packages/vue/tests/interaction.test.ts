// The interaction options and gesture events of #33 in Vue (React's `tests/interaction.test.tsx`):
// the new engine options and `defaultEdgeOptions` as root props, one event per engine event
// (`ENGINE_EVENT_CALLBACKS`, its first letter lowercased: `nodeClick`, `moveStart`, `init`, …;
// `@node-click` in a template), `Handle`'s `connectable-start` / `connectable-end`, the Controls'
// lock switching dragging, connecting and selecting, and a reconnect anchor drawn only at an end
// that may move.
import { ENGINE_EVENT_CALLBACKS, type FlowEdge } from "@fragiola/flow";
import { connection } from "@fragiola/flow/connection";
import { drag as dragFeature } from "@fragiola/flow/drag";
import { reconnection } from "@fragiola/flow/reconnection";
import { selection } from "@fragiola/flow/selection";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { h, shallowRef } from "vue";
import { createFlowRef, Flow, type FlowNode } from "../src/index";
import {
    click,
    drag,
    installLayout,
    part,
    render,
    settle,
    TestFlow,
    task,
} from "./flow";

beforeEach(installLayout);

describe("the root's events", () => {
    it("has one per engine event, named from the core's table (the callback, its first letter lowercased)", () => {
        const emits = (Flow.Root as unknown as { emits: string[] }).emits;
        expect(emits).toEqual([
            "update:nodes",
            "update:edges",
            "update:viewport",
            ...Object.values(ENGINE_EVENT_CALLBACKS).map(
                (name) => `${name[0]?.toLowerCase()}${name.slice(1)}`,
            ),
        ]);
        expect(emits).toContain("nodeClick");
        expect(emits).toContain("moveStart");
        expect(emits).toContain("init");
        expect(emits).toContain("connectCancel");
        expect(emits).toContain("resizeEnd");
        expect(emits).toContain("delete");
    });

    it("emits the event to the latest listener, and puts none on the element", async () => {
        const first = vi.fn();
        const second = vi.fn();
        const onInit = vi.fn();
        const onPaneClick = vi.fn();
        const onMoveStart = vi.fn();
        const onMoveEnd = vi.fn();
        const listener = shallowRef<(...args: unknown[]) => void>(first);
        const { container } = await render(() =>
            h(TestFlow, {
                defaultNodes: [task("a", 0, 0)],
                features: [selection()],
                onNodeClick: listener.value,
                onInit,
                onPaneClick,
                onMoveStart,
                onMoveEnd,
            }),
        );
        expect(onInit).toHaveBeenCalledWith({ type: "ready" });
        expect(onInit).toHaveBeenCalledOnce();
        listener.value = second;
        await settle();
        const root = part(container, "root");
        expect(root.getAttribute("onNodeClick")).toBeNull();
        expect(root.getAttribute("onnodeclick")).toBeNull();
        await drag(part(container, "node", "a"), root, [
            { clientX: 10, clientY: 10 },
        ]);
        expect(first).not.toHaveBeenCalled();
        expect(second).toHaveBeenCalledWith(
            expect.objectContaining({ type: "node-click", nodeId: "a" }),
        );
        expect(second.mock.calls[0]).toHaveLength(1);
        await drag(root, root, [
            { clientX: 500, clientY: 400 },
            { clientX: 540, clientY: 400 },
        ]);
        expect(onPaneClick).not.toHaveBeenCalled();
        expect(onMoveStart).toHaveBeenCalledOnce();
        expect(onMoveEnd).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "viewport-change-end",
                viewport: { x: 40, y: 0, zoom: 1 },
            }),
        );
        await drag(root, root, [{ clientX: 500, clientY: 400 }]);
        expect(onPaneClick).toHaveBeenCalledOnce();
    });
});

describe("the new engine options and defaultEdgeOptions", () => {
    it("reach the engine, and the model the root creates", async () => {
        const ref = createFlowRef();
        const prevent = shallowRef<boolean | undefined>(false);
        const { container } = await render(() =>
            h(TestFlow, {
                flowRef: ref,
                defaultNodes: [task("a"), task("b", 0, 200)],
                defaultEdgeOptions: { type: "step" },
                preventScrolling: prevent.value,
                zoomOnScroll: false,
            }),
        );
        const root = part(container, "root");
        const wheel = new WheelEvent("wheel", {
            bubbles: true,
            cancelable: true,
            deltaY: 10,
        });
        root.dispatchEvent(wheel);
        expect(wheel.defaultPrevented).toBe(false);
        prevent.value = undefined;
        await settle();
        const prevented = new WheelEvent("wheel", {
            bubbles: true,
            cancelable: true,
            deltaY: 10,
        });
        root.dispatchEvent(prevented);
        expect(prevented.defaultPrevented).toBe(true);
        ref.value?.model.run("edge.add", { source: "a", target: "b" });
        expect(ref.value?.model.get("all-edges")[0]?.type).toBe("step");
    });

    it("take a bare boolean attribute as true", async () => {
        const ref = createFlowRef();
        const { container } = await render(() =>
            h(TestFlow, {
                flowRef: ref,
                defaultNodes: [task("a")],
                "prevent-scrolling": "",
                "zoom-on-scroll": false,
            }),
        );
        const wheel = new WheelEvent("wheel", {
            bubbles: true,
            cancelable: true,
            deltaY: 10,
        });
        part(container, "root").dispatchEvent(wheel);
        expect(wheel.defaultPrevented).toBe(true);
    });

    it("take the tap distances, as numbers or their attribute's text", async () => {
        const onPaneClick = vi.fn();
        const { container } = await render(() =>
            h(TestFlow, {
                defaultNodes: [task("a")],
                "pane-click-distance": "30",
                onPaneClick,
            }),
        );
        const root = part(container, "root");
        await drag(root, root, [
            { clientX: 500, clientY: 400 },
            { clientX: 520, clientY: 400 },
        ]);
        expect(onPaneClick).toHaveBeenCalledOnce();
    });
});

/** A flow of two nodes with named handles, for connections. */
function handles(
    props: {
        start?: boolean;
        end?: boolean;
        reconnectable?: boolean | "source" | "target";
    } & Record<string, unknown> = {},
) {
    const { start, end, reconnectable, ...root } = props;
    return () =>
        h(
            Flow.Root,
            {
                defaultNodes: [task("a", 0, 0), task("b", 300, 0)],
                defaultEdges:
                    reconnectable === undefined
                        ? []
                        : [
                              {
                                  id: "e",
                                  source: "a",
                                  sourceHandle: "out",
                                  target: "b",
                                  targetHandle: "in",
                                  reconnectable,
                              } as FlowEdge,
                          ],
                features: [connection(), reconnection()],
                ...root,
            },
            () =>
                h(Flow.Viewport, null, () => [
                    h(Flow.Edges, null, {
                        default: ({ edge }: { edge: FlowEdge }) => [
                            h(Flow.Edge, { edge }, () => [
                                h(Flow.EdgePath),
                                h(Flow.ReconnectAnchor, { end: "source" }),
                                h(Flow.ReconnectAnchor, { end: "target" }),
                            ]),
                        ],
                    }),
                    h(Flow.Nodes, null, {
                        default: ({ node }: { node: FlowNode }) => [
                            h(Flow.Node, { node }, () =>
                                node.id === "a"
                                    ? h(Flow.Handle, {
                                          type: "source",
                                          side: "right",
                                          handleId: "out",
                                          connectableStart: start,
                                      })
                                    : h(Flow.Handle, {
                                          type: "target",
                                          side: "left",
                                          handleId: "in",
                                          connectableEnd: end,
                                      }),
                            ),
                        ],
                    }),
                ]),
        );
}

describe("Handle's connectable-start and connectable-end", () => {
    it("reach the registration, the part attributes and the state", async () => {
        const onConnectStart = vi.fn();
        const { container } = await render(
            handles({ start: false, end: false, onConnectStart }),
        );
        const out = part(container, "handle", "out");
        const into = part(container, "handle", "in");
        expect(out.hasAttribute("data-connectable-start")).toBe(false);
        expect(out.hasAttribute("data-connectable-end")).toBe(true);
        expect(into.hasAttribute("data-connectable-end")).toBe(false);
        await drag(out, part(container, "root"), [
            { clientX: 100, clientY: 20 },
            { clientX: 200, clientY: 20 },
        ]);
        expect(onConnectStart).not.toHaveBeenCalled();
    });

    it("take a bare attribute as true, and give the roles in the state", async () => {
        const states: { start: boolean; end: boolean }[] = [];
        await render(() =>
            h(
                Flow.Root,
                { defaultNodes: [task("a")], features: [connection()] },
                () =>
                    h(Flow.Viewport, null, () =>
                        h(Flow.Nodes, null, {
                            default: ({ node }: { node: FlowNode }) => [
                                h(Flow.Node, { node }, () =>
                                    h(
                                        Flow.Handle,
                                        {
                                            type: "source",
                                            side: "right",
                                            "connectable-start": "",
                                            connectableEnd: false,
                                        },
                                        {
                                            default: ({
                                                state,
                                            }: {
                                                state: {
                                                    connectableStart: boolean;
                                                    connectableEnd: boolean;
                                                };
                                            }) => {
                                                states.push({
                                                    start: state.connectableStart,
                                                    end: state.connectableEnd,
                                                });
                                                return [];
                                            },
                                        },
                                    ),
                                ),
                            ],
                        }),
                    ),
            ),
        );
        expect(states.at(-1)).toEqual({ start: true, end: false });
    });
});

describe("ReconnectAnchor", () => {
    it("draws only at an end that may move", async () => {
        const { container } = await render(
            handles({ reconnectable: "target" }),
        );
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
        const { container } = await render(() =>
            h(
                TestFlow,
                {
                    flowRef: ref,
                    defaultNodes: [task("a")],
                    features: [selection(), dragFeature()],
                },
                () =>
                    h(Flow.Controls, null, () =>
                        h(Flow.ToggleInteractive, null, () => "lock"),
                    ),
            ),
        );
        const button = part(container, "toggle-interactive");
        expect(button.getAttribute("aria-pressed")).toBe("false");
        await click(button);
        const engine = ref.value?.engine;
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
        expect(ref.value?.model.get("node-by", { id: "a" })?.position.x).toBe(
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
