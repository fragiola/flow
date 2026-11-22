// The interaction options and gesture events of #33 in React: the new engine options and
// `defaultEdgeOptions` as root props, one callback per engine event (`ENGINE_EVENT_CALLBACKS`:
// `onNodeClick`, `onMoveStart`, …), `Handle`'s `connectableStart` / `connectableEnd`, the
// Controls' lock switching dragging, connecting and selecting, and a reconnect anchor drawn only at
// an end that may move.
import { ENGINE_EVENT_CALLBACKS } from "@fragiola/flow";
import { connection } from "@fragiola/flow/connection";
import { drag as dragFeature } from "@fragiola/flow/drag";
import { reconnection } from "@fragiola/flow/reconnection";
import { selection } from "@fragiola/flow/selection";
import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFlowRef, Flow, type RootProps } from "../src/index";
import { drag, installLayout, part, settle, TestFlow, task } from "./flow";

beforeEach(installLayout);

describe("the root's event callbacks", () => {
    it("has one per engine event, named from the core's table", () => {
        const names = Object.values(ENGINE_EVENT_CALLBACKS).map(
            (name) => `on${name}`,
        );
        expect(names).toContain("onNodeClick");
        expect(names).toContain("onMoveStart");
        expect(names).toContain("onInit");
        // every name is a prop of the root (a type error otherwise)
        const props: Required<
            Pick<RootProps, "onNodeClick" | "onMoveEnd" | "onConnectCancel">
        > = {
            onNodeClick: () => {},
            onMoveEnd: () => {},
            onConnectCancel: () => {},
        };
        expect(Object.keys(props)).toHaveLength(3);
    });

    it("calls the latest callback with the event, and spreads none on the element", async () => {
        const first = vi.fn();
        const second = vi.fn();
        const onInit = vi.fn();
        const onPaneClick = vi.fn();
        const onMoveStart = vi.fn();
        const onMoveEnd = vi.fn();
        const { container, rerender } = render(
            <TestFlow
                defaultNodes={[task("a", 0, 0)]}
                features={[selection()]}
                onNodeClick={first}
                onInit={onInit}
            />,
        );
        await settle();
        expect(onInit).toHaveBeenCalledWith({ type: "ready" });
        rerender(
            <TestFlow
                defaultNodes={[task("a", 0, 0)]}
                features={[selection()]}
                onNodeClick={second}
                onPaneClick={onPaneClick}
                onMoveStart={onMoveStart}
                onMoveEnd={onMoveEnd}
            />,
        );
        const root = part(container, "root");
        expect(root.getAttribute("onNodeClick")).toBeNull();
        drag(part(container, "node", "a"), root, [
            { clientX: 10, clientY: 10 },
        ]);
        expect(first).not.toHaveBeenCalled();
        expect(second).toHaveBeenCalledWith(
            expect.objectContaining({ type: "node-click", nodeId: "a" }),
        );
        drag(root, root, [
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
        drag(root, root, [{ clientX: 500, clientY: 400 }]);
        expect(onPaneClick).toHaveBeenCalledOnce();
    });
});

describe("the new engine options and defaultEdgeOptions", () => {
    it("reach the engine, and the model the root creates", async () => {
        const ref = createFlowRef();
        const { container, rerender } = render(
            <TestFlow
                flowRef={ref}
                defaultNodes={[task("a"), task("b", 0, 200)]}
                defaultEdgeOptions={{ type: "step" }}
                preventScrolling={false}
                zoomOnScroll={false}
            />,
        );
        await settle();
        const root = part(container, "root");
        const wheel = new WheelEvent("wheel", {
            bubbles: true,
            cancelable: true,
            deltaY: 10,
        });
        root.dispatchEvent(wheel);
        expect(wheel.defaultPrevented).toBe(false);
        rerender(
            <TestFlow
                flowRef={ref}
                defaultNodes={[task("a"), task("b", 0, 200)]}
                zoomOnScroll={false}
            />,
        );
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
        const onPaneClick = vi.fn();
        const { container } = render(
            <TestFlow
                defaultNodes={[task("a")]}
                paneClickDistance={30}
                onPaneClick={onPaneClick}
            />,
        );
        await settle();
        const root = part(container, "root");
        drag(root, root, [
            { clientX: 500, clientY: 400 },
            { clientX: 520, clientY: 400 },
        ]);
        expect(onPaneClick).toHaveBeenCalledOnce();
    });
});

/** A flow of two nodes with named handles, for connections. */
function Handles(
    props: Partial<RootProps> & {
        start?: boolean;
        end?: boolean;
        reconnectable?: boolean | "source" | "target";
    },
) {
    const { start, end, reconnectable, ...root } = props;
    return (
        <Flow.Root
            defaultNodes={[task("a", 0, 0), task("b", 300, 0)]}
            defaultEdges={
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
                          },
                      ]
            }
            features={[connection(), reconnection()]}
            {...root}
        >
            <Flow.Viewport>
                <Flow.Edges>
                    {(edge) => (
                        <Flow.Edge edge={edge}>
                            <Flow.EdgePath />
                            <Flow.ReconnectAnchor end="source" />
                            <Flow.ReconnectAnchor end="target" />
                        </Flow.Edge>
                    )}
                </Flow.Edges>
                <Flow.Nodes>
                    {(node) => (
                        <Flow.Node node={node}>
                            {node.id === "a" ? (
                                <Flow.Handle
                                    type="source"
                                    side="right"
                                    handleId="out"
                                    connectableStart={start}
                                />
                            ) : (
                                <Flow.Handle
                                    type="target"
                                    side="left"
                                    handleId="in"
                                    connectableEnd={end}
                                />
                            )}
                        </Flow.Node>
                    )}
                </Flow.Nodes>
            </Flow.Viewport>
        </Flow.Root>
    );
}

describe("Handle's connectableStart and connectableEnd", () => {
    it("reach the registration and the part attributes", async () => {
        const onConnectStart = vi.fn();
        const { container } = render(
            <Handles
                start={false}
                end={false}
                onConnectStart={onConnectStart}
            />,
        );
        await settle();
        const out = part(container, "handle", "out");
        const into = part(container, "handle", "in");
        expect(out.hasAttribute("data-connectable-start")).toBe(false);
        expect(out.hasAttribute("data-connectable-end")).toBe(true);
        expect(into.hasAttribute("data-connectable-end")).toBe(false);
        drag(out, part(container, "root"), [
            { clientX: 100, clientY: 20 },
            { clientX: 200, clientY: 20 },
        ]);
        expect(onConnectStart).not.toHaveBeenCalled();
    });
});

describe("ReconnectAnchor", () => {
    it("draws only at an end that may move", async () => {
        const { container } = render(<Handles reconnectable="target" />);
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
        const { container } = render(
            <TestFlow
                flowRef={ref}
                defaultNodes={[task("a")]}
                features={[selection(), dragFeature()]}
            >
                <Flow.Controls>
                    <Flow.ToggleInteractive>lock</Flow.ToggleInteractive>
                </Flow.Controls>
            </TestFlow>,
        );
        await settle();
        const button = part(container, "toggle-interactive");
        expect(button.getAttribute("aria-pressed")).toBe("false");
        fireEvent.click(button);
        const engine = ref.current?.engine;
        expect(engine?.is("interactive-by", { kind: "drag" })).toBe(false);
        expect(engine?.is("interactive-by", { kind: "connect" })).toBe(false);
        expect(engine?.is("interactive-by", { kind: "select" })).toBe(false);
        expect(engine?.is("interactive")).toBe(true);
        expect(button.getAttribute("aria-pressed")).toBe("true");
        // locked: a drag moves nothing
        drag(part(container, "node", "a"), part(container, "root"), [
            { clientX: 10, clientY: 10 },
            { clientX: 60, clientY: 10 },
        ]);
        expect(ref.current?.model.get("node-by", { id: "a" })?.position.x).toBe(
            0,
        );
        fireEvent.click(button);
        expect(engine?.is("interactive-by", { kind: "drag" })).toBe(true);
        expect(button.getAttribute("aria-pressed")).toBe("false");
        // a flow locked by `interactive` unlocks whole
        engine?.run("set-interactive", { interactive: false });
        await settle();
        expect(button.getAttribute("aria-pressed")).toBe("true");
        fireEvent.click(button);
        expect(engine?.is("interactive")).toBe(true);
    });
});
