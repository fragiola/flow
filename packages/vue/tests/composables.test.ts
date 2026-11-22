// #36's composables: each triggers its component's render when what it selected changed, and only
// then (the render counts), and reads what the core gives (`node-connections-by`, `nodes-data-by`,
// `internal-node-by`, `watchKeyPress`, the viewport events): React's `tests/hooks.test.tsx`.
import { selection } from "@fragiola/flow/selection";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    type Component,
    defineComponent,
    h,
    nextTick,
    type Ref,
    shallowRef,
} from "vue";
import {
    createFlowRef,
    Flow,
    type FlowNode,
    type FlowRef,
    useFlowStore,
    useInternalNode,
    useKeyPress,
    useNodeConnections,
    useNodeId,
    useNodesData,
    useOnViewportChange,
    type Viewport,
} from "../src/index";
import { installLayout, pair, render, settle, TestFlow, task } from "./flow";

beforeEach(() => {
    installLayout();
});

/** A component that counts its renders and records each value it rendered with. */
function probe<V>(use: () => Readonly<Ref<V>>) {
    const seen: V[] = [];
    const Probe = defineComponent({
        setup() {
            const value = use();
            return () => {
                seen.push(value.value);
                return null;
            };
        },
    });
    return { Probe, seen };
}

/** The flow's model and engine, once mounted. */
function flowOf(flow: FlowRef) {
    const value = flow.value;
    if (!value) throw new Error("not mounted");
    return value;
}

/** Runs a change of the flow and waits for its renders. */
async function change(run: () => void): Promise<void> {
    run();
    await settle();
}

/** A root whose nodes render `inside` (given each node), with the root's props. */
function nodesFlow(
    props: Record<string, unknown>,
    inside: (node: FlowNode) => unknown = () => null,
    outside: () => unknown = () => null,
) {
    return () =>
        h(Flow.Root, props, () => [
            outside(),
            h(Flow.Viewport, null, () =>
                h(Flow.Nodes, null, {
                    default: ({ node }: { node: FlowNode }) => [
                        h(Flow.Node, { node }, () => inside(node)),
                    ],
                }),
            ),
        ]);
}

describe("useFlowStore", () => {
    it("renders again only when the selected value changes, from the model or the engine", async () => {
        const flow = createFlowRef();
        const count = probe(() =>
            useFlowStore(({ model }) => model.get("all-nodes").length),
        );
        const zoom = probe(() =>
            useFlowStore(({ engine }) => engine.get("viewport").zoom),
        );
        await render(() =>
            h(TestFlow, { flowRef: flow, defaultNodes: pair().nodes }, () => [
                h(count.Probe),
                h(zoom.Probe),
            ]),
        );
        const counted = count.seen.length;
        const zoomed = zoom.seen.length;
        await change(() =>
            flowOf(flow).model.run("node.move", {
                nodeId: "a",
                position: { x: 30, y: 0 },
            }),
        );
        await change(() =>
            flowOf(flow).engine.run("set-viewport", { x: 40, y: 0 }),
        );
        expect(count.seen.length).toBe(counted);
        expect(zoom.seen.length).toBe(zoomed);
        await change(() =>
            flowOf(flow).model.run("node.add", {
                id: "c",
                type: "task",
                position: { x: 0, y: 400 },
                data: {},
            }),
        );
        await change(() => flowOf(flow).engine.run("zoom-to", { zoom: 1.5 }));
        expect(count.seen.slice(counted)).toEqual([3]);
        expect(zoom.seen.slice(zoomed)).toEqual([1.5]);
    });

    it("takes an equality for a selector that builds a value", async () => {
        const flow = createFlowRef();
        const ids = probe(() =>
            useFlowStore(
                ({ model }) => model.get("all-nodes").map((node) => node.id),
                (a, b) => a.join() === b.join(),
            ),
        );
        await render(() =>
            h(TestFlow, { flowRef: flow, defaultNodes: pair().nodes }, () => [
                h(ids.Probe),
            ]),
        );
        const before = ids.seen.length;
        await change(() =>
            flowOf(flow).model.run("node.move", {
                nodeId: "a",
                position: { x: 30, y: 0 },
            }),
        );
        expect(ids.seen.length).toBe(before);
    });
});

describe("useNodeId", () => {
    it("is the enclosing node's id, or null outside one", async () => {
        const id = probe(() => useNodeId());
        await render(
            nodesFlow(
                { defaultNodes: pair().nodes },
                () => h(id.Probe),
                () => h(id.Probe),
            ),
        );
        expect(id.seen[0]).toBeNull();
        expect(new Set(id.seen)).toEqual(new Set([null, "a", "b"]));
    });
});

describe("useNodesData", () => {
    it("gives one node's data or several, rendering again only when their data changes", async () => {
        const flow = createFlowRef();
        const one = probe(() => useNodesData("a"));
        const many = probe(() => useNodesData(["b", "gone", "a"]));
        await render(() =>
            h(
                TestFlow,
                {
                    flowRef: flow,
                    defaultNodes: [
                        task("a", 0, 0, { data: { label: "A" } }),
                        task("b", 0, 200, { data: { label: "B" } }),
                    ],
                },
                () => [h(one.Probe), h(many.Probe)],
            ),
        );
        expect(one.seen.at(-1)).toEqual({
            id: "a",
            type: "task",
            data: { label: "A" },
        });
        expect(many.seen.at(-1)?.map((entry) => entry.id)).toEqual(["b", "a"]);
        const ones = one.seen.length;
        const manys = many.seen.length;
        await change(() =>
            flowOf(flow).model.run("node.move", {
                nodeId: "a",
                position: { x: 30, y: 0 },
            }),
        );
        expect(one.seen.length).toBe(ones);
        expect(many.seen.length).toBe(manys);
        await change(() =>
            flowOf(flow).model.run("node.set-data", {
                nodeId: "b",
                data: { label: "B2" },
            }),
        );
        expect(one.seen.length).toBe(ones);
        expect(many.seen.length).toBe(manys + 1);
        expect(many.seen.at(-1)?.[0]?.data).toEqual({ label: "B2" });
        await change(() =>
            flowOf(flow).model.run("node.remove", { nodeId: "a" }),
        );
        expect(one.seen.at(-1)).toBeNull();
    });
});

describe("useNodeConnections", () => {
    it("gives the enclosing node's connections, rendering again only when they change", async () => {
        const flow = createFlowRef();
        const connections = probe(() => {
            const list = useNodeConnections({ type: "target" });
            return {
                get value() {
                    return list.value.map((connection) => connection.edgeId);
                },
            } as Readonly<Ref<string[]>>;
        });
        await render(
            nodesFlow(
                {
                    flowRef: flow,
                    defaultNodes: [
                        task("a"),
                        task("b", 0, 200),
                        task("c", 300, 0),
                    ],
                    defaultEdges: [{ id: "ab", source: "a", target: "b" }],
                },
                (node) => (node.id === "b" ? h(connections.Probe) : null),
            ),
        );
        const seen = connections.seen;
        expect(seen.at(-1)).toEqual(["ab"]);
        const before = seen.length;
        await change(() =>
            flowOf(flow).model.run("edge.set-data", {
                edgeId: "ab",
                data: { weight: 2 },
            }),
        );
        await change(() =>
            flowOf(flow).model.run("node.move", {
                nodeId: "a",
                position: { x: 30, y: 0 },
            }),
        );
        expect(seen.length).toBe(before);
        await change(() =>
            flowOf(flow).model.run("edge.add", {
                id: "cb",
                source: "c",
                target: "b",
            }),
        );
        expect(seen.slice(before)).toEqual([["ab", "cb"]]);
    });

    it("takes a node by its id, and needs one outside a node", async () => {
        const count = probe(() => {
            const list = useNodeConnections({ id: "a" });
            return {
                get value() {
                    return list.value.length;
                },
            } as Readonly<Ref<number>>;
        });
        const { nodes, edges } = pair();
        await render(() =>
            h(Flow.Root, { defaultNodes: nodes, defaultEdges: edges }, () =>
                h(count.Probe),
            ),
        );
        expect(count.seen.at(-1)).toBe(1);
        const Lost: Component = defineComponent({
            setup() {
                useNodeConnections();
                return () => null;
            },
        });
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        await expect(
            render(() => h(Flow.Root, { defaultNodes: nodes }, () => h(Lost))),
        ).rejects.toThrow(/inside Flow.Node/);
        warn.mockRestore();
    });
});

describe("useInternalNode", () => {
    it("gives the node's box and handles, rendering again on a move or a measurement, not on a pan", async () => {
        const flow = createFlowRef();
        const internal = probe(() => useInternalNode("a"));
        await render(() =>
            h(
                TestFlow,
                {
                    flowRef: flow,
                    features: [selection()],
                    defaultNodes: pair().nodes,
                    defaultEdges: pair().edges,
                },
                () => [h(internal.Probe)],
            ),
        );
        expect(internal.seen.at(-1)).toMatchObject({
            id: "a",
            rect: { x: 0, y: 0, width: 100, height: 40 },
            measured: true,
        });
        expect(internal.seen.at(-1)?.handles).toHaveLength(2);
        const before = internal.seen.length;
        await change(() =>
            flowOf(flow).engine.run("set-viewport", { x: 50, y: 10 }),
        );
        await change(() =>
            flowOf(flow).model.run("node.move", {
                nodeId: "b",
                position: { x: 30, y: 300 },
            }),
        );
        expect(internal.seen.length).toBe(before);
        await change(() =>
            flowOf(flow).model.run("node.move", {
                nodeId: "a",
                position: { x: 30, y: 0 },
            }),
        );
        expect(internal.seen.length).toBeGreaterThan(before);
        expect(internal.seen.at(-1)?.rect.x).toBe(30);
    });
});

describe("useKeyPress", () => {
    const key = async (
        target: EventTarget,
        type: "keydown" | "keyup",
        name: string,
        code: string,
    ) => {
        target.dispatchEvent(new KeyboardEvent(type, { key: name, code }));
        await nextTick();
    };

    it("tells whether a combo is held on the root's window, rendering again only when that changes", async () => {
        const held = probe(() => useKeyPress(["Meta+s", "Control+s"]));
        await render(() =>
            h(TestFlow, { defaultNodes: pair().nodes }, () => [h(held.Probe)]),
        );
        const before = held.seen.length;
        await key(window, "keydown", "s", "KeyS");
        await key(window, "keyup", "s", "KeyS");
        expect(held.seen.length).toBe(before);
        await key(window, "keydown", "Control", "ControlLeft");
        await key(window, "keydown", "s", "KeyS");
        await key(window, "keydown", "s", "KeyS");
        expect(held.seen.slice(before)).toEqual([true]);
        await key(window, "keyup", "s", "KeyS");
        expect(held.seen.slice(before)).toEqual([true, false]);
    });

    it("reads a target of its own", async () => {
        const field = document.createElement("input");
        document.body.append(field);
        const held = probe(() => useKeyPress("Shift", { target: field }));
        await render(() => h(held.Probe));
        await key(window, "keydown", "Shift", "ShiftLeft");
        expect(held.seen.at(-1)).toBe(false);
        await key(field, "keydown", "Shift", "ShiftLeft");
        expect(held.seen.at(-1)).toBe(true);
        field.remove();
    });
});

describe("useOnViewportChange", () => {
    it("calls back on the start, each change and the end, without rendering again", async () => {
        const flow = createFlowRef();
        const calls: string[] = [];
        let renders = 0;
        const Watcher = defineComponent({
            setup() {
                useOnViewportChange({
                    onStart: (viewport, gesture) =>
                        calls.push(`start ${viewport.x} ${gesture}`),
                    onChange: (viewport) => calls.push(`change ${viewport.x}`),
                    onEnd: (viewport) => calls.push(`end ${viewport.x}`),
                });
                return () => {
                    renders++;
                    return null;
                };
            },
        });
        await render(() =>
            h(TestFlow, { flowRef: flow, defaultNodes: pair().nodes }, () => [
                h(Watcher),
            ]),
        );
        const before = renders;
        await change(() =>
            flowOf(flow).engine.run("set-viewport", { x: 70, y: 0 }),
        );
        expect(calls).toEqual(["start 0 false", "change 70", "end 70"]);
        expect(renders).toBe(before);
    });

    it("takes a ref or a getter, read at each event", async () => {
        const flow = createFlowRef();
        const calls: string[] = [];
        const options = shallowRef({
            onEnd: (viewport: Viewport) => calls.push(`ref ${viewport.x}`),
        });
        let label = "first";
        const Watcher = defineComponent({
            setup() {
                useOnViewportChange(options);
                useOnViewportChange(() => ({
                    onEnd: (viewport) => calls.push(`${label} ${viewport.x}`),
                }));
                return () => null;
            },
        });
        await render(() =>
            h(TestFlow, { flowRef: flow, defaultNodes: pair().nodes }, () => [
                h(Watcher),
            ]),
        );
        await change(() =>
            flowOf(flow).engine.run("set-viewport", { x: 10, y: 0 }),
        );
        expect(calls).toEqual(["ref 10", "first 10"]);
        options.value = {
            onEnd: (viewport: Viewport) => calls.push(`new ref ${viewport.x}`),
        };
        label = "second";
        await change(() =>
            flowOf(flow).engine.run("set-viewport", { x: 20, y: 0 }),
        );
        expect(calls).toEqual([
            "ref 10",
            "first 10",
            "new ref 20",
            "second 20",
        ]);
    });
});
