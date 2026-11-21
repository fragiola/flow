import { drag as dragFeature } from "@fragiola/flow/drag";
import { selection } from "@fragiola/flow/selection";
import { subflows } from "@fragiola/flow/subflows";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { h, ref, shallowRef } from "vue";
import {
    type CommandEvent,
    createFlowModel,
    createFlowRef,
    type FlowEdge,
    type FlowModel,
    type FlowNode,
    veto,
} from "../src/index";
import {
    drag,
    installLayout,
    part,
    render,
    settle,
    TestFlow,
    task,
} from "./flow";

beforeEach(() => {
    installLayout();
});

const features = [selection(), dragFeature()] as const;

describe("controlled nodes and edges (v-model:nodes, v-model:edges)", () => {
    it("bring the model to the props with commands, and report every change of the model", async () => {
        const commits: CommandEvent[] = [];
        const nodes = shallowRef<readonly FlowNode[]>([
            task("a"),
            task("b", 0, 200),
        ]);
        const edges = shallowRef<readonly FlowEdge[]>([]);
        const flow = createFlowRef();
        const { container } = await render(() =>
            h(TestFlow, {
                flowRef: flow,
                features,
                nodes: nodes.value,
                "onUpdate:nodes": (next: readonly FlowNode[]) => {
                    nodes.value = next;
                },
                edges: edges.value,
                "onUpdate:edges": (next: readonly FlowEdge[]) => {
                    edges.value = next;
                },
            }),
        );
        const model = flow.value?.model as FlowModel;
        model.subscribe((event) => commits.push(event));
        // the app moves a node and adds one: node.move and node.add, marked as the props'
        nodes.value = [task("a", 30, 0), task("b", 0, 200), task("c", 300)];
        await settle();
        expect(part(container, "node", "a").style.transform).toBe(
            "translate(30px, 0px)",
        );
        expect(part(container, "node", "c")).toBeInTheDocument();
        expect(commits.at(-1)?.command).toBe("batch");
        expect(commits.at(-1)?.commands?.map((step) => step.command)).toEqual([
            "node.add",
            "node.move",
        ]);
        expect(commits.at(-1)?.meta).toEqual({ source: "controlled" });
        // a drag reports the model's nodes, which come back as the same props: nothing to run
        const count = commits.length;
        await drag(part(container, "node", "b"), part(container, "root"), [
            { clientX: 10, clientY: 210 },
            { clientX: 60, clientY: 210 },
        ]);
        expect(part(container, "node", "b").style.transform).toBe(
            "translate(50px, 200px)",
        );
        expect(
            commits
                .slice(count)
                .every((event) => event.meta?.source !== "controlled"),
        ).toBe(true);
        expect(nodes.value).toBe(model.get("all-nodes"));
        expect(model.get("node-by", { id: "b" })?.position).toEqual({
            x: 50,
            y: 200,
        });
    });

    it("take a deep reactive list (a ref) as plain data", async () => {
        const nodes = ref<FlowNode[]>([task("a"), task("b", 0, 200)]);
        const flow = createFlowRef();
        const { container } = await render(() =>
            h(TestFlow, {
                flowRef: flow,
                nodes: nodes.value,
                "onUpdate:nodes": (next: readonly FlowNode[]) => {
                    nodes.value = [...next];
                },
            }),
        );
        nodes.value.push(task("c", 300));
        nodes.value = [...nodes.value];
        await settle();
        expect(part(container, "node", "c")).toBeInTheDocument();
        const held = flow.value?.model.get("node-by", { id: "c" });
        expect(Object.isFrozen(held)).toBe(true);
        expect(held?.position).toEqual({ x: 300, y: 0 });
    });

    it("move, remove and connect locked nodes: the props are the app's document", async () => {
        const changed = vi.fn();
        const fixed = task("a", 0, 0, { draggable: false, deletable: false });
        const other = task("b", 0, 200);
        const nodes = shallowRef<readonly FlowNode[]>([fixed, other]);
        const { container } = await render(() =>
            h(TestFlow, { nodes: nodes.value, "onUpdate:nodes": changed }),
        );
        nodes.value = [{ ...fixed, position: { x: 9, y: 9 } }, other];
        await settle();
        expect(part(container, "node", "a").style.transform).toBe(
            "translate(9px, 9px)",
        );
        nodes.value = [other];
        await settle();
        expect(container.querySelector('[data-flow-id="a"]')).toBeNull();
        expect(changed).not.toHaveBeenCalled();
    });

    it("report what the model holds when a middleware refuses a prop", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const changed = vi.fn();
        const model = createFlowModel({
            version: 1,
            nodes: [task("a")],
            edges: [],
        }) as unknown as FlowModel;
        model.use((ctx, next) =>
            ctx.command === "node.move" ? veto("frozen") : next(),
        );
        const start = model.get("all-nodes");
        const nodes = shallowRef<readonly FlowNode[]>(start);
        const { container } = await render(() =>
            h(TestFlow, {
                model,
                nodes: nodes.value,
                "onUpdate:nodes": changed,
            }),
        );
        nodes.value = [
            { ...(start[0] as FlowNode), position: { x: 9, y: 9 } },
            task("b", 300),
        ];
        await settle();
        expect(part(container, "node", "a").style.transform).toBe(
            "translate(0px, 0px)",
        );
        // what could be made was: b is there; the app hears the model's nodes
        expect(part(container, "node", "b")).toBeInTheDocument();
        expect(changed).toHaveBeenLastCalledWith(model.get("all-nodes"));
        expect(warn).toHaveBeenCalled();
    });

    it("report what the model holds when a rule changed the props (a child kept in its parent)", async () => {
        const changed = vi.fn();
        const parent = task("p", 0, 0, { width: 200, height: 200 });
        const child = task("c", 10, 10, { parentId: "p", extent: "parent" });
        const nodes = shallowRef<readonly FlowNode[]>([parent, child]);
        await render(() =>
            h(TestFlow, {
                features: [subflows()],
                nodes: nodes.value,
                "onUpdate:nodes": changed,
            }),
        );
        nodes.value = [parent, { ...child, position: { x: -50, y: 10 } }];
        await settle();
        const reported = changed.mock.calls.at(-1)?.[0] as readonly FlowNode[];
        expect(reported.find((node) => node.id === "c")?.position).toEqual({
            x: 0,
            y: 10,
        });
    });

    it("leave the edges the app does not control to the model: a removed node takes its own", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const all = [task("a"), task("b", 0, 200)];
        const nodes = shallowRef<readonly FlowNode[]>(all);
        const { container } = await render(() =>
            h(TestFlow, {
                nodes: nodes.value,
                defaultEdges: [{ id: "ab", source: "a", target: "b" }],
            }),
        );
        expect(part(container, "edge", "ab")).toBeInTheDocument();
        nodes.value = [all[0] as FlowNode];
        await settle();
        expect(container.querySelector('[data-flow-part="edge"]')).toBeNull();
        expect(warn).not.toHaveBeenCalled();
    });

    it("controls the edges too, and works over a model the app gives", async () => {
        const model = createFlowModel({
            version: 1,
            nodes: [task("a"), task("b", 0, 200)],
            edges: [],
        }) as unknown as FlowModel;
        const edges = shallowRef<readonly FlowEdge[]>([]);
        const { container } = await render(() =>
            h(TestFlow, { model, edges: edges.value }),
        );
        edges.value = [{ id: "ab", source: "a", target: "b" }];
        await settle();
        expect(model.get("all-edges").map((edge) => edge.id)).toEqual(["ab"]);
        expect(part(container, "edge", "ab")).toBeInTheDocument();
        edges.value = [];
        await settle();
        expect(container.querySelector('[data-flow-part="edge"]')).toBeNull();
    });

    it("brings a model the app gives to the props it starts with", async () => {
        const model = createFlowModel({
            version: 1,
            nodes: [task("a")],
            edges: [],
        }) as unknown as FlowModel;
        const { container } = await render(() =>
            h(TestFlow, { model, nodes: [task("a", 40, 0)] }),
        );
        expect(model.get("node-by", { id: "a" })?.position).toEqual({
            x: 40,
            y: 0,
        });
        expect(part(container, "node", "a").style.transform).toBe(
            "translate(40px, 0px)",
        );
    });

    it("an uncontrolled root reads defaultNodes once", async () => {
        const x = shallowRef(0);
        const { container } = await render(() =>
            h(TestFlow, { defaultNodes: [task("a", x.value)] }),
        );
        x.value = 100;
        await settle();
        expect(part(container, "node", "a").style.transform).toBe(
            "translate(0px, 0px)",
        );
    });

    it("another model remounts the flow on it", async () => {
        const first = createFlowModel({
            version: 1,
            nodes: [task("a")],
            edges: [],
        }) as unknown as FlowModel;
        const second = createFlowModel({
            version: 1,
            nodes: [task("b", 0, 200)],
            edges: [],
        }) as unknown as FlowModel;
        const model = shallowRef(first);
        const { container } = await render(() =>
            h(TestFlow, { model: model.value }),
        );
        expect(part(container, "node", "a")).toBeInTheDocument();
        model.value = second;
        await settle();
        expect(container.querySelector('[data-flow-id="a"]')).toBeNull();
        expect(part(container, "node", "b").style.transform).toBe(
            "translate(0px, 200px)",
        );
        expect(part(container, "root").style.touchAction).toBe("none");
    });
});
