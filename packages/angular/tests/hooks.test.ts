// #36's injection functions: each signal changes when what it selected changed, and only then (the
// updates an effect sees, React's render counts), and reads what the core gives
// (`node-connections-by`, `nodes-data-by`, `internal-node-by`, `watchKeyPress`, the viewport
// events): React's `tests/hooks.test.tsx`.
import {
    Component,
    computed,
    ErrorHandler,
    effect,
    HostAttributeToken,
    inject,
    input,
    type Signal,
    untracked,
} from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { connection } from "@fragiola/flow/connection";
import { selection } from "@fragiola/flow/selection";
import { beforeEach, describe, expect, it } from "vitest";
import {
    createFlowRef,
    FLOW,
    type FlowEdge,
    type FlowFeatures,
    type FlowNode,
    type FlowRef,
    injectFlowStore,
    injectInternalNode,
    injectKeyPress,
    injectNodeConnections,
    injectNodeId,
    injectNodesData,
    injectOnViewportChange,
} from "../src/public-api";
import { installLayout, pair, render, settle, task } from "./flow";

/** What each probe reads, by its `name` attribute: an injection function's signal. */
let readers: Record<string, () => Signal<unknown>> = {};
/** Every value each probe's signal took, the first one included. */
let seen: Record<string, unknown[]> = {};

beforeEach(() => {
    installLayout();
    readers = {};
    seen = {};
});

/** Records each value its reader's signal takes (an effect: an equal value is no update). */
@Component({ selector: "test-hook-probe", template: "" })
class HookProbe {
    private readonly name = inject(new HostAttributeToken("name"));
    private readonly value = readers[this.name]?.();

    constructor() {
        const list: unknown[] = [];
        seen[this.name] = seen[this.name] ?? list;
        const values = seen[this.name] ?? list;
        effect(() => {
            const value = this.value?.();
            if (this.value) untracked(() => values.push(value));
        });
    }
}

/** A flow with probes: two in the root, one in each node, one outside the root. */
@Component({
    selector: "test-hook-flow",
    imports: [FLOW, HookProbe],
    template: `
        <div flowRoot [features]="features()" [defaultNodes]="defaultNodes()" [defaultEdges]="defaultEdges()" [flowRef]="flowRef()">
            <div flowViewport>
                <div flowEdges>
                    <svg:g *flowEdgesItem="let edge" [flowEdge]="edge"></svg:g>
                </div>
                <div flowNodes>
                    <div *flowNodesItem="let node" [flowNode]="node">
                        <div flowHandle type="target" side="top"></div>
                        <div flowHandle type="source" side="bottom"></div>
                        <test-hook-probe name="node" />
                    </div>
                </div>
            </div>
            <test-hook-probe name="first" />
            <test-hook-probe name="second" />
        </div>
        <test-hook-probe name="outside" />
    `,
})
class HookFlow {
    readonly features = input<FlowFeatures | undefined>();
    readonly defaultNodes = input<readonly FlowNode[] | undefined>();
    readonly defaultEdges = input<readonly FlowEdge[] | undefined>();
    readonly flowRef = input<FlowRef | undefined>();
}

/** The flow's model and engine, once mounted. */
function flowOf(ref: FlowRef) {
    const flow = ref.current;
    if (!flow) throw new Error("not mounted");
    return flow;
}

/** Runs a change of the flow and lets Angular render. */
async function change(run: () => void): Promise<void> {
    run();
    await settle();
}

const values = (name: string) => seen[name] ?? [];

describe("injectFlowStore", () => {
    it("changes only when the selected value changes, from the model or the engine", async () => {
        const ref = createFlowRef();
        readers.first = () =>
            injectFlowStore(({ model }) => model.get("all-nodes").length);
        readers.second = () =>
            injectFlowStore(({ engine }) => engine.get("viewport").zoom);
        await render(HookFlow, { flowRef: ref, defaultNodes: pair().nodes });
        const counted = values("first").length;
        const zoomed = values("second").length;
        await change(() =>
            flowOf(ref).model.run("node.move", {
                nodeId: "a",
                position: { x: 30, y: 0 },
            }),
        );
        await change(() =>
            flowOf(ref).engine.run("set-viewport", { x: 40, y: 0 }),
        );
        expect(values("first").length).toBe(counted);
        expect(values("second").length).toBe(zoomed);
        await change(() =>
            flowOf(ref).model.run("node.add", {
                id: "c",
                type: "task",
                position: { x: 0, y: 400 },
                data: {},
            }),
        );
        await change(() => flowOf(ref).engine.run("zoom-to", { zoom: 1.5 }));
        expect(values("first").slice(counted)).toEqual([3]);
        expect(values("second").slice(zoomed)).toEqual([1.5]);
    });

    it("takes an equality for a selector that builds a value", async () => {
        const ref = createFlowRef();
        readers.first = () =>
            injectFlowStore(
                ({ model }) => model.get("all-nodes").map((node) => node.id),
                (a, b) => a.join() === b.join(),
            );
        await render(HookFlow, { flowRef: ref, defaultNodes: pair().nodes });
        const before = values("first").length;
        await change(() =>
            flowOf(ref).model.run("node.move", {
                nodeId: "a",
                position: { x: 30, y: 0 },
            }),
        );
        expect(values("first").length).toBe(before);
    });
});

describe("injectNodeId", () => {
    it("is the enclosing node's id, or null outside one", async () => {
        readers.first = () => injectNodeId();
        readers.node = () => injectNodeId();
        readers.outside = () => injectNodeId();
        await render(HookFlow, { defaultNodes: pair().nodes });
        expect(values("first")).toEqual([null]);
        expect(values("outside")).toEqual([null]);
        expect(new Set(values("node"))).toEqual(new Set(["a", "b"]));
    });
});

describe("injectNodesData", () => {
    it("gives one node's data or several, changing only when their data changes", async () => {
        const ref = createFlowRef();
        readers.first = () => injectNodesData("a");
        readers.second = () => injectNodesData(["b", "gone", "a"]);
        await render(HookFlow, {
            flowRef: ref,
            defaultNodes: [
                task("a", 0, 0, { data: { label: "A" } }),
                task("b", 0, 200, { data: { label: "B" } }),
            ],
        });
        expect(values("first").at(-1)).toEqual({
            id: "a",
            type: "task",
            data: { label: "A" },
        });
        const many = () =>
            values("second") as readonly { id: string; data: unknown }[][];
        expect(
            many()
                .at(-1)
                ?.map((entry) => entry.id),
        ).toEqual(["b", "a"]);
        const ones = values("first").length;
        const manys = many().length;
        await change(() =>
            flowOf(ref).model.run("node.move", {
                nodeId: "a",
                position: { x: 30, y: 0 },
            }),
        );
        expect(values("first").length).toBe(ones);
        expect(many().length).toBe(manys);
        await change(() =>
            flowOf(ref).model.run("node.set-data", {
                nodeId: "b",
                data: { label: "B2" },
            }),
        );
        expect(values("first").length).toBe(ones);
        expect(many().length).toBe(manys + 1);
        expect(many().at(-1)?.[0]?.data).toEqual({ label: "B2" });
        await change(() =>
            flowOf(ref).model.run("node.remove", { nodeId: "a" }),
        );
        expect(values("first").at(-1)).toBeNull();
    });
});

describe("injectNodeConnections", () => {
    it("gives the enclosing node's connections, changing only when they change", async () => {
        const ref = createFlowRef();
        // node b's probe only
        readers.node = () => {
            const id = injectNodeId();
            const connections = injectNodeConnections({ type: "target" });
            return computed(() =>
                id() === "b"
                    ? connections().map((connection) => connection.edgeId)
                    : null,
            );
        };
        await render(HookFlow, {
            flowRef: ref,
            defaultNodes: [task("a"), task("b", 0, 200), task("c", 300, 0)],
            defaultEdges: [{ id: "ab", source: "a", target: "b" }],
        });
        const ofB = () => values("node").filter((value) => value !== null);
        expect(ofB().at(-1)).toEqual(["ab"]);
        const before = ofB().length;
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
        expect(ofB().length).toBe(before);
        await change(() =>
            flowOf(ref).model.run("edge.add", {
                id: "cb",
                source: "c",
                target: "b",
            }),
        );
        expect(ofB().slice(before)).toEqual([["ab", "cb"]]);
    });

    it("takes a node by its id, and needs one outside a node", async () => {
        readers.first = () => injectNodeConnections({ id: "a" });
        await render(HookFlow, {
            defaultNodes: pair().nodes,
            defaultEdges: pair().edges,
        });
        expect((values("first").at(-1) as unknown[]).length).toBe(1);
        readers = { second: () => injectNodeConnections() };
        const handled: unknown[] = [];
        const handler = TestBed.inject(ErrorHandler);
        const original = handler.handleError;
        handler.handleError = (error: unknown) => handled.push(error);
        await render(HookFlow, { defaultNodes: pair().nodes }).catch(
            (error: unknown) => handled.push(error),
        );
        handler.handleError = original;
        expect(String(handled[0])).toMatch(
            /injectNodeConnections must be called inside \[flowNode\]/,
        );
    });
});

describe("injectInternalNode", () => {
    it("gives the node's box and handles, changing on a move or a measurement, not on a pan", async () => {
        const ref = createFlowRef();
        readers.first = () => injectInternalNode("a");
        await render(HookFlow, {
            flowRef: ref,
            features: [selection()],
            defaultNodes: pair().nodes,
            defaultEdges: pair().edges,
        });
        const internal = () =>
            values("first") as ({
                rect: { x: number };
                handles: unknown[];
            } | null)[];
        expect(internal().at(-1)).toMatchObject({
            id: "a",
            rect: { x: 0, y: 0, width: 100, height: 40 },
            measured: true,
        });
        expect(internal().at(-1)?.handles).toHaveLength(2);
        const before = internal().length;
        await change(() =>
            flowOf(ref).engine.run("set-viewport", { x: 50, y: 10 }),
        );
        await change(() =>
            flowOf(ref).model.run("node.move", {
                nodeId: "b",
                position: { x: 30, y: 300 },
            }),
        );
        expect(internal().length).toBe(before);
        await change(() =>
            flowOf(ref).model.run("node.move", {
                nodeId: "a",
                position: { x: 30, y: 0 },
            }),
        );
        expect(internal().length).toBeGreaterThan(before);
        expect(internal().at(-1)?.rect.x).toBe(30);
    });
});

describe("injectKeyPress", () => {
    const key = async (
        target: EventTarget,
        type: "keydown" | "keyup",
        name: string,
        code: string,
    ) => {
        target.dispatchEvent(new KeyboardEvent(type, { key: name, code }));
        await settle();
    };

    it("tells whether a combo is held on the root's window, changing only when that does", async () => {
        readers.first = () => injectKeyPress(["Meta+s", "Control+s"]);
        readers.outside = () => injectKeyPress("Shift");
        await render(HookFlow, { defaultNodes: pair().nodes });
        const before = values("first").length;
        await key(window, "keydown", "s", "KeyS");
        await key(window, "keyup", "s", "KeyS");
        expect(values("first").length).toBe(before);
        await key(window, "keydown", "Control", "ControlLeft");
        await key(window, "keydown", "s", "KeyS");
        await key(window, "keydown", "s", "KeyS");
        expect(values("first").slice(before)).toEqual([true]);
        await key(window, "keyup", "s", "KeyS");
        expect(values("first").slice(before)).toEqual([true, false]);
        // outside a root without a target: never pressed
        await key(window, "keydown", "Shift", "ShiftLeft");
        expect(values("outside")).toEqual([false]);
    });

    it("reads a target of its own", async () => {
        const field = document.createElement("input");
        document.body.append(field);
        readers.outside = () => injectKeyPress("Shift", { target: field });
        await render(HookFlow, { defaultNodes: pair().nodes });
        await key(window, "keydown", "Shift", "ShiftLeft");
        expect(values("outside").at(-1)).toBe(false);
        await key(field, "keydown", "Shift", "ShiftLeft");
        expect(values("outside").at(-1)).toBe(true);
        field.remove();
    });
});

describe("injectOnViewportChange", () => {
    it("calls back on the start, each change and the end, with nothing to update", async () => {
        const ref = createFlowRef();
        const calls: string[] = [];
        readers.first = () => {
            injectOnViewportChange({
                onStart: (viewport, gesture) =>
                    calls.push(`start ${viewport.x} ${gesture}`),
                onChange: (viewport) => calls.push(`change ${viewport.x}`),
                onEnd: (viewport) => calls.push(`end ${viewport.x}`),
            });
            return computed(() => "static");
        };
        await render(HookFlow, { flowRef: ref, defaultNodes: pair().nodes });
        await change(() =>
            flowOf(ref).engine.run("set-viewport", { x: 70, y: 0 }),
        );
        expect(calls).toEqual(["start 0 false", "change 70", "end 70"]);
    });
});

interface Types {
    readonly nodes: { task: { title: string }; note: { text: string } };
    readonly edges: { dependency: { weight: number } };
}

const typedFeatures = [connection()] as const;

/** The injection functions' types (checked by ngc, never rendered). */
@Component({ selector: "test-typed-hooks", template: "" })
class TypedHooks {
    readonly id = input("a");
    readonly count: Signal<number> = injectFlowStore<
        number,
        Types,
        typeof typedFeatures
    >(
        ({ model, engine }) =>
            model.get("all-nodes").length + engine.get("viewport").zoom,
    );
    readonly one = injectNodesData<Types>(this.id);
    readonly title = computed((): string | undefined => {
        const node = this.one();
        return node?.type === "task" ? node.data.title : undefined;
    });
    readonly many = injectNodesData<Types>(["a", "b"]);
    readonly first = computed((): string | undefined => this.many()[0]?.id);
    readonly connections = injectNodeConnections({
        handleId: "in",
        type: "target",
    });
    readonly edgeId = computed(
        (): string | undefined => this.connections()[0]?.edgeId,
    );
    // @ts-expect-error a connection's type is source or target
    readonly wrong = injectNodeConnections({ type: "in" });
    readonly internal = injectInternalNode<Types>(() => this.id());
    readonly width = computed(
        (): number | undefined => this.internal()?.rect.width,
    );
    readonly pressed: Signal<boolean> = injectKeyPress(
        ["Meta+s", "Control+s"],
        { target: null },
    );
    readonly nodeId: Signal<string | null> = injectNodeId();

    constructor() {
        injectOnViewportChange({
            onEnd: (viewport, gesture: boolean) =>
                void [viewport.zoom, gesture],
        });
    }
}

describe("the injection functions' types", () => {
    it("are checked by ngc (strict templates) on a component", () => {
        expect(TypedHooks).toBeTypeOf("function");
    });
});
