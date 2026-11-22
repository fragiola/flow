// #36's hooks: each re-renders its component when what it selected changed, and only then (the
// render counts), and reads what the core gives (`node-connections-by`, `nodes-data-by`,
// `internal-node-by`, `watchKeyPress`, the viewport events).
import { selection } from "@fragiola/flow/selection";
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    createFlowRef,
    Flow,
    type FlowRef,
    useFlowStore,
    useInternalNode,
    useKeyPress,
    useNodeConnections,
    useNodeId,
    useNodesData,
    useOnViewportChange,
} from "../src/index";
import { installLayout, pair, settle, TestFlow, task } from "./flow";

beforeEach(() => {
    installLayout();
});

/** A component that counts its renders and records each value it rendered with. */
function probe<V>(read: () => V) {
    const seen: V[] = [];
    function Probe() {
        seen.push(read());
        return null;
    }
    return { Probe, seen };
}

/** The flow's model and engine, once mounted. */
function flowOf(ref: FlowRef) {
    const flow = ref.current;
    if (!flow) throw new Error("not mounted");
    return flow;
}

/** Runs a change of the flow and waits for its re-renders. */
async function change(run: () => void): Promise<void> {
    act(run);
    await settle();
}

describe("useFlowStore", () => {
    it("re-renders only when the selected value changes, from the model or the engine", async () => {
        const ref = createFlowRef();
        const count = probe(() =>
            useFlowStore(({ model }) => model.get("all-nodes").length),
        );
        const zoom = probe(() =>
            useFlowStore(({ engine }) => engine.get("viewport").zoom),
        );
        render(
            <TestFlow flowRef={ref} defaultNodes={pair().nodes}>
                <count.Probe />
                <zoom.Probe />
            </TestFlow>,
        );
        await settle();
        const counted = count.seen.length;
        const zoomed = zoom.seen.length;
        await change(() =>
            flowOf(ref).model.run("node.move", {
                nodeId: "a",
                position: { x: 30, y: 0 },
            }),
        );
        await change(() =>
            flowOf(ref).engine.run("set-viewport", { x: 40, y: 0 }),
        );
        expect(count.seen.length).toBe(counted);
        expect(zoom.seen.length).toBe(zoomed);
        await change(() =>
            flowOf(ref).model.run("node.add", {
                id: "c",
                type: "task",
                position: { x: 0, y: 400 },
                data: {},
            }),
        );
        await change(() => flowOf(ref).engine.run("zoom-to", { zoom: 1.5 }));
        expect(count.seen.slice(counted)).toEqual([3]);
        expect(zoom.seen.slice(zoomed)).toEqual([1.5]);
    });

    it("takes an equality for a selector that builds a value", async () => {
        const ref = createFlowRef();
        const ids = probe(() =>
            useFlowStore(
                ({ model }) => model.get("all-nodes").map((node) => node.id),
                (a, b) => a.join() === b.join(),
            ),
        );
        render(
            <TestFlow flowRef={ref} defaultNodes={pair().nodes}>
                <ids.Probe />
            </TestFlow>,
        );
        await settle();
        const before = ids.seen.length;
        await change(() =>
            flowOf(ref).model.run("node.move", {
                nodeId: "a",
                position: { x: 30, y: 0 },
            }),
        );
        expect(ids.seen.length).toBe(before);
    });
});

describe("useNodeId", () => {
    it("is the enclosing node's id, or null outside one", async () => {
        const seen: (string | null)[] = [];
        function Id() {
            seen.push(useNodeId());
            return null;
        }
        render(
            <Flow.Root defaultNodes={pair().nodes}>
                <Id />
                <Flow.Viewport>
                    <Flow.Nodes>
                        {(node) => (
                            <Flow.Node node={node}>
                                <Id />
                            </Flow.Node>
                        )}
                    </Flow.Nodes>
                </Flow.Viewport>
            </Flow.Root>,
        );
        await settle();
        expect(seen[0]).toBeNull();
        expect(new Set(seen)).toEqual(new Set([null, "a", "b"]));
    });
});

describe("useNodesData", () => {
    it("gives one node's data or several, re-rendering only when their data changes", async () => {
        const ref = createFlowRef();
        const one = probe(() => useNodesData("a"));
        const many = probe(() => useNodesData(["b", "gone", "a"]));
        render(
            <TestFlow
                flowRef={ref}
                defaultNodes={[
                    task("a", 0, 0, { data: { label: "A" } }),
                    task("b", 0, 200, { data: { label: "B" } }),
                ]}
            >
                <one.Probe />
                <many.Probe />
            </TestFlow>,
        );
        await settle();
        expect(one.seen.at(-1)).toEqual({
            id: "a",
            type: "task",
            data: { label: "A" },
        });
        expect(many.seen.at(-1)?.map((entry) => entry.id)).toEqual(["b", "a"]);
        const ones = one.seen.length;
        const manys = many.seen.length;
        await change(() =>
            flowOf(ref).model.run("node.move", {
                nodeId: "a",
                position: { x: 30, y: 0 },
            }),
        );
        expect(one.seen.length).toBe(ones);
        expect(many.seen.length).toBe(manys);
        await change(() =>
            flowOf(ref).model.run("node.set-data", {
                nodeId: "b",
                data: { label: "B2" },
            }),
        );
        expect(one.seen.length).toBe(ones);
        expect(many.seen.length).toBe(manys + 1);
        expect(many.seen.at(-1)?.[0]?.data).toEqual({ label: "B2" });
        await change(() =>
            flowOf(ref).model.run("node.remove", { nodeId: "a" }),
        );
        expect(one.seen.at(-1)).toBeNull();
    });
});

describe("useNodeConnections", () => {
    it("gives the enclosing node's connections, re-rendering only when they change", async () => {
        const ref = createFlowRef();
        const seen: string[][] = [];
        function Connections() {
            const connections = useNodeConnections({ type: "target" });
            seen.push(connections.map((connection) => connection.edgeId));
            return null;
        }
        render(
            <Flow.Root
                flowRef={ref}
                defaultNodes={[task("a"), task("b", 0, 200), task("c", 300, 0)]}
                defaultEdges={[{ id: "ab", source: "a", target: "b" }]}
            >
                <Flow.Viewport>
                    <Flow.Nodes>
                        {(node) => (
                            <Flow.Node node={node}>
                                {node.id === "b" ? <Connections /> : null}
                            </Flow.Node>
                        )}
                    </Flow.Nodes>
                </Flow.Viewport>
            </Flow.Root>,
        );
        await settle();
        expect(seen.at(-1)).toEqual(["ab"]);
        const before = seen.length;
        await change(() =>
            flowOf(ref).model.run("edge.set-data", {
                edgeId: "ab",
                data: { weight: 2 },
            }),
        );
        await change(() =>
            flowOf(ref).model.run("node.move", {
                nodeId: "a",
                position: { x: 30, y: 0 },
            }),
        );
        expect(seen.length).toBe(before);
        await change(() =>
            flowOf(ref).model.run("edge.add", {
                id: "cb",
                source: "c",
                target: "b",
            }),
        );
        expect(seen.slice(before)).toEqual([["ab", "cb"]]);
    });

    it("takes a node by its id, and needs one outside a node", async () => {
        const seen: number[] = [];
        function Connections() {
            seen.push(useNodeConnections({ id: "a" }).length);
            return null;
        }
        render(
            <Flow.Root defaultNodes={pair().nodes} defaultEdges={pair().edges}>
                <Connections />
            </Flow.Root>,
        );
        expect(seen.at(-1)).toBe(1);
        function Lost() {
            useNodeConnections();
            return null;
        }
        const error = vi.spyOn(console, "error").mockImplementation(() => {});
        expect(() =>
            render(
                <Flow.Root defaultNodes={pair().nodes}>
                    <Lost />
                </Flow.Root>,
            ),
        ).toThrow(/inside Flow.Node/);
        error.mockRestore();
    });
});

describe("useInternalNode", () => {
    it("gives the node's box and handles, re-rendering on a move or a measurement, not on a pan", async () => {
        const ref = createFlowRef();
        const internal = probe(() => useInternalNode("a"));
        render(
            <TestFlow
                flowRef={ref}
                features={[selection()]}
                defaultNodes={pair().nodes}
                defaultEdges={pair().edges}
            >
                <internal.Probe />
            </TestFlow>,
        );
        await settle();
        expect(internal.seen.at(-1)).toMatchObject({
            id: "a",
            rect: { x: 0, y: 0, width: 100, height: 40 },
            measured: true,
        });
        expect(internal.seen.at(-1)?.handles).toHaveLength(2);
        const before = internal.seen.length;
        await change(() =>
            flowOf(ref).engine.run("set-viewport", { x: 50, y: 10 }),
        );
        await change(() =>
            flowOf(ref).model.run("node.move", {
                nodeId: "b",
                position: { x: 30, y: 300 },
            }),
        );
        expect(internal.seen.length).toBe(before);
        await change(() =>
            flowOf(ref).model.run("node.move", {
                nodeId: "a",
                position: { x: 30, y: 0 },
            }),
        );
        expect(internal.seen.length).toBeGreaterThan(before);
        expect(internal.seen.at(-1)?.rect.x).toBe(30);
    });
});

describe("useKeyPress", () => {
    it("tells whether a combo is held on the root's window, re-rendering only when that changes", async () => {
        const seen = probe(() => useKeyPress(["Meta+s", "Control+s"]));
        render(
            <TestFlow defaultNodes={pair().nodes}>
                <seen.Probe />
            </TestFlow>,
        );
        await settle();
        const key = (type: "keydown" | "keyup", name: string, code: string) =>
            act(() => {
                window.dispatchEvent(
                    new KeyboardEvent(type, { key: name, code }),
                );
            });
        const before = seen.seen.length;
        key("keydown", "s", "KeyS");
        key("keyup", "s", "KeyS");
        expect(seen.seen.length).toBe(before);
        key("keydown", "Control", "ControlLeft");
        key("keydown", "s", "KeyS");
        key("keydown", "s", "KeyS");
        expect(seen.seen.slice(before)).toEqual([true]);
        key("keyup", "s", "KeyS");
        expect(seen.seen.slice(before)).toEqual([true, false]);
    });

    it("reads a target of its own", async () => {
        const field = document.createElement("input");
        document.body.append(field);
        const seen = probe(() => useKeyPress("Shift", { target: field }));
        render(<seen.Probe />);
        act(() => {
            window.dispatchEvent(
                new KeyboardEvent("keydown", {
                    key: "Shift",
                    code: "ShiftLeft",
                }),
            );
        });
        expect(seen.seen.at(-1)).toBe(false);
        act(() => {
            field.dispatchEvent(
                new KeyboardEvent("keydown", {
                    key: "Shift",
                    code: "ShiftLeft",
                }),
            );
        });
        expect(seen.seen.at(-1)).toBe(true);
        field.remove();
    });
});

describe("useOnViewportChange", () => {
    it("calls back on the start, each change and the end, without re-rendering", async () => {
        const ref = createFlowRef();
        const calls: string[] = [];
        let renders = 0;
        function Watcher() {
            renders++;
            useOnViewportChange({
                onStart: (viewport, gesture) =>
                    calls.push(`start ${viewport.x} ${gesture}`),
                onChange: (viewport) => calls.push(`change ${viewport.x}`),
                onEnd: (viewport) => calls.push(`end ${viewport.x}`),
            });
            return null;
        }
        render(
            <TestFlow flowRef={ref} defaultNodes={pair().nodes}>
                <Watcher />
            </TestFlow>,
        );
        await settle();
        const before = renders;
        await change(() =>
            flowOf(ref).engine.run("set-viewport", { x: 70, y: 0 }),
        );
        expect(calls).toEqual(["start 0 false", "change 70", "end 70"]);
        expect(renders).toBe(before);
    });
});
