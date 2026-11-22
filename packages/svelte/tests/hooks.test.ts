// #36's runes: each notifies its readers when what it selected changed, and only then (the
// renders of a probe's template), and reads what the core gives (`node-connections-by`,
// `nodes-data-by`, `internal-node-by`, `watchKeyPress`, the viewport events). React's
// tests/hooks.test.tsx.
import { selection } from "@fragiola/flow/selection";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    type AnyTypes,
    createFlowRef,
    type FlowFeatures,
    type FlowRef,
    type NodeData,
    useFlowStore,
    useInternalNode,
    useKeyPress,
    useNodeConnections,
    useNodeId,
    useNodesData,
    useOnViewportChange,
} from "../src/index";
import HooksFlow from "./fixtures/hooks-flow.svelte";
import HooksProbe from "./fixtures/hooks-probe.svelte";
import { installLayout, pair, render, settle, task } from "./flow";

beforeEach(() => {
    installLayout();
});

/** The flow's model and engine, once mounted. */
function flowOf(ref: FlowRef<AnyTypes, FlowFeatures>) {
    const flow = ref.current;
    if (!flow) throw new Error("not mounted");
    return flow;
}

/** Runs a change of the flow and lets Svelte flush. */
async function change(run: () => void): Promise<void> {
    run();
    await settle();
}

/** `count` lists of what each probe rendered. */
const lists = (count: number): unknown[][] =>
    Array.from({ length: count }, () => []);

describe("useFlowStore", () => {
    it("notifies only when the selected value changes, from the model or the engine", async () => {
        const ref = createFlowRef<AnyTypes, FlowFeatures>();
        const seen = lists(2);
        await render(HooksFlow, {
            flowRef: ref,
            defaultNodes: pair().nodes,
            seen,
            outside: [
                () =>
                    useFlowStore(({ model }) => model.get("all-nodes").length),
                () => useFlowStore(({ engine }) => engine.get("viewport").zoom),
            ],
        });
        const [count, zoom] = seen as [unknown[], unknown[]];
        const counted = count.length;
        const zoomed = zoom.length;
        await change(() =>
            flowOf(ref).model.run("node.move", {
                nodeId: "a",
                position: { x: 25, y: 0 },
            }),
        );
        await change(() =>
            flowOf(ref).engine.run("set-viewport", { x: 35, y: 0 }),
        );
        expect(count.length).toBe(counted);
        expect(zoom.length).toBe(zoomed);
        await change(() =>
            flowOf(ref).model.run("node.add", {
                id: "c",
                type: "task",
                position: { x: 0, y: 500 },
                data: {},
            }),
        );
        await change(() => flowOf(ref).engine.run("zoom-to", { zoom: 1.75 }));
        expect(count.slice(counted)).toEqual([3]);
        expect(zoom.slice(zoomed)).toEqual([1.75]);
    });

    it("takes an equality for a selector that builds a value", async () => {
        const ref = createFlowRef<AnyTypes, FlowFeatures>();
        const seen = lists(1);
        await render(HooksFlow, {
            flowRef: ref,
            defaultNodes: pair().nodes,
            seen,
            outside: [
                () =>
                    useFlowStore(
                        ({ model }) =>
                            model.get("all-nodes").map((node) => node.id),
                        (a, b) => a.join() === b.join(),
                    ),
            ],
        });
        const before = seen[0]?.length;
        await change(() =>
            flowOf(ref).model.run("node.move", {
                nodeId: "b",
                position: { x: 40, y: 200 },
            }),
        );
        expect(seen[0]?.length).toBe(before);
    });
});

describe("useNodeId", () => {
    it("is the enclosing node's id, or null outside one", async () => {
        const seen = lists(1);
        await render(HooksFlow, {
            defaultNodes: pair().nodes,
            seen,
            outside: [() => ({ current: useNodeId() })],
            inside: () => () => ({ current: useNodeId() }),
        });
        expect(new Set(seen[0])).toEqual(new Set([null, "a", "b"]));
    });
});

describe("useNodesData", () => {
    it("gives one node's data or several, notifying only when their data changes", async () => {
        const ref = createFlowRef<AnyTypes, FlowFeatures>();
        const seen = lists(2);
        await render(HooksFlow, {
            flowRef: ref,
            defaultNodes: [
                task("a", 0, 0, { data: { label: "first" } }),
                task("b", 0, 200, { data: { label: "second" } }),
            ],
            seen,
            outside: [
                () => useNodesData("a"),
                () => useNodesData(["b", "missing", "a"]),
            ],
        });
        const [one, many] = seen as [
            (NodeData | null)[],
            (readonly NodeData[])[],
        ];
        expect(one.at(-1)).toEqual({
            id: "a",
            type: "task",
            data: { label: "first" },
        });
        expect(many.at(-1)?.map((entry) => entry.id)).toEqual(["b", "a"]);
        const ones = one.length;
        const manys = many.length;
        await change(() =>
            flowOf(ref).model.run("node.move", {
                nodeId: "a",
                position: { x: 45, y: 0 },
            }),
        );
        expect(one.length).toBe(ones);
        expect(many.length).toBe(manys);
        await change(() =>
            flowOf(ref).model.run("node.set-data", {
                nodeId: "b",
                data: { label: "changed" },
            }),
        );
        expect(one.length).toBe(ones);
        expect(many.length).toBe(manys + 1);
        expect(many.at(-1)?.[0]?.data).toEqual({ label: "changed" });
        await change(() =>
            flowOf(ref).model.run("node.remove", { nodeId: "a" }),
        );
        expect(one.at(-1)).toBeNull();
    });
});

describe("useNodeConnections", () => {
    it("gives the enclosing node's connections, notifying only when they change", async () => {
        const ref = createFlowRef<AnyTypes, FlowFeatures>();
        const seen = lists(1);
        await render(HooksFlow, {
            flowRef: ref,
            defaultNodes: [task("a"), task("b", 0, 200), task("c", 300, 0)],
            defaultEdges: [{ id: "ab", source: "a", target: "b" }],
            seen,
            inside: (nodeId: string) =>
                nodeId === "b"
                    ? () => {
                          const connections = useNodeConnections({
                              type: "target",
                          });
                          return {
                              get current() {
                                  return connections.current.map(
                                      (connection) => connection.edgeId,
                                  );
                              },
                          };
                      }
                    : undefined,
        });
        const list = seen[0] as string[][];
        expect(list.at(-1)).toEqual(["ab"]);
        const before = list.length;
        await change(() =>
            flowOf(ref).model.run("edge.set-data", {
                edgeId: "ab",
                data: { weight: 3 },
            }),
        );
        await change(() =>
            flowOf(ref).model.run("node.move", {
                nodeId: "a",
                position: { x: 20, y: 0 },
            }),
        );
        expect(list.length).toBe(before);
        await change(() =>
            flowOf(ref).model.run("edge.add", {
                id: "cb",
                source: "c",
                target: "b",
            }),
        );
        expect(list.slice(before)).toEqual([["ab", "cb"]]);
    });

    it("takes a node by its id, and needs one outside a node", async () => {
        const seen = lists(1);
        await render(HooksFlow, {
            defaultNodes: pair().nodes,
            defaultEdges: pair().edges,
            seen,
            outside: [() => useNodeConnections({ id: "a" })],
        });
        expect(seen[0]?.at(-1)).toHaveLength(1);
        const error = vi.spyOn(console, "error").mockImplementation(() => {});
        await expect(
            render(HooksFlow, {
                defaultNodes: pair().nodes,
                seen: lists(1),
                outside: [() => useNodeConnections()],
            }),
        ).rejects.toThrow(/inside Flow.Node/);
        error.mockRestore();
    });
});

describe("useInternalNode", () => {
    it("gives the node's box and handles, notifying on a move, not on a pan", async () => {
        const ref = createFlowRef<AnyTypes, FlowFeatures>();
        const seen = lists(1);
        await render(HooksFlow, {
            flowRef: ref,
            features: [selection()],
            defaultNodes: pair().nodes,
            defaultEdges: pair().edges,
            seen,
            outside: [() => useInternalNode("a")],
        });
        const list = seen[0] as {
            rect: { x: number };
            handles: unknown[];
        }[];
        expect(list.at(-1)).toMatchObject({
            id: "a",
            rect: { x: 0, y: 0, width: 100, height: 40 },
            measured: true,
        });
        expect(list.at(-1)?.handles).toHaveLength(2);
        const before = list.length;
        await change(() =>
            flowOf(ref).engine.run("set-viewport", { x: 60, y: 15 }),
        );
        await change(() =>
            flowOf(ref).model.run("node.move", {
                nodeId: "b",
                position: { x: 20, y: 320 },
            }),
        );
        expect(list.length).toBe(before);
        await change(() =>
            flowOf(ref).model.run("node.move", {
                nodeId: "a",
                position: { x: 45, y: 0 },
            }),
        );
        expect(list.length).toBeGreaterThan(before);
        expect(list.at(-1)?.rect.x).toBe(45);
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
        await settle();
    };

    it("tells whether a combo is held on the root's window, notifying only when that changes", async () => {
        const seen = lists(1);
        await render(HooksFlow, {
            defaultNodes: pair().nodes,
            seen,
            outside: [() => useKeyPress(["Meta+k", "Control+k"])],
        });
        const list = seen[0] as boolean[];
        const before = list.length;
        await key(window, "keydown", "k", "KeyK");
        await key(window, "keyup", "k", "KeyK");
        expect(list.length).toBe(before);
        await key(window, "keydown", "Control", "ControlLeft");
        await key(window, "keydown", "k", "KeyK");
        await key(window, "keydown", "k", "KeyK");
        expect(list.slice(before)).toEqual([true]);
        await key(window, "keyup", "k", "KeyK");
        expect(list.slice(before)).toEqual([true, false]);
        await key(window, "keyup", "Control", "ControlLeft");
    });

    it("reads a target of its own, outside a root too", async () => {
        const field = document.createElement("input");
        document.body.append(field);
        const seen: unknown[] = [];
        await render(HooksProbe, {
            seen,
            use: () => useKeyPress("Alt", { target: field }),
        });
        await key(window, "keydown", "Alt", "AltLeft");
        expect(seen.at(-1)).toBe(false);
        await key(field, "keydown", "Alt", "AltLeft");
        expect(seen.at(-1)).toBe(true);
        field.remove();
    });
});

describe("useOnViewportChange", () => {
    it("calls back on the start, each change and the end", async () => {
        const ref = createFlowRef<AnyTypes, FlowFeatures>();
        const calls: string[] = [];
        await render(HooksFlow, {
            flowRef: ref,
            defaultNodes: pair().nodes,
            seen: [],
            watch: () =>
                useOnViewportChange({
                    onstart: (viewport, gesture) =>
                        calls.push(`start ${viewport.x} ${gesture}`),
                    onchange: (viewport) => calls.push(`change ${viewport.x}`),
                    onend: (viewport) => calls.push(`end ${viewport.x}`),
                }),
        });
        await change(() =>
            flowOf(ref).engine.run("set-viewport", { x: 55, y: 0 }),
        );
        expect(calls).toEqual(["start 0 false", "change 55", "end 55"]);
    });
});
