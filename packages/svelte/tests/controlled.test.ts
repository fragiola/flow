import { drag as dragFeature } from "@fragiola/flow/drag";
import { selection } from "@fragiola/flow/selection";
import { subflows } from "@fragiola/flow/subflows";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    type CommandEvent,
    createFlowModel,
    createFlowRef,
    type FlowEdge,
    type FlowModel,
    type FlowNode,
    veto,
} from "../src/index";
import ControlledFlow from "./fixtures/controlled-flow.svelte";
import TestFlow from "./fixtures/test-flow.svelte";
import { drag, installLayout, part, render, settle, task } from "./flow";

beforeEach(() => {
    installLayout();
});

const features = [selection(), dragFeature()] as const;

interface Controlled {
    setNodes(next: readonly FlowNode[]): void;
    pushNode(node: FlowNode): void;
    getNodes(): readonly FlowNode[] | undefined;
    setEdges(next: readonly FlowEdge[]): void;
    getEdges(): readonly FlowEdge[] | undefined;
}

describe("controlled nodes and edges (bind:nodes, bind:edges)", () => {
    it("bring the model to the props with commands, and write every change of the model back", async () => {
        const commits: CommandEvent[] = [];
        const changed = vi.fn();
        const flow = createFlowRef();
        const { container, component } = await render(ControlledFlow, {
            flowRef: flow,
            features,
            initialNodes: [task("a"), task("b", 0, 200)],
            initialEdges: [],
            onnodeschange: changed,
        });
        const app = component as unknown as Controlled;
        const model = flow.current?.model as FlowModel;
        model.subscribe((event) => commits.push(event));
        // the app moves a node and adds one: node.move and node.add, marked as the props'
        app.setNodes([task("a", 30, 0), task("b", 0, 200), task("c", 300)]);
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
        expect(changed).not.toHaveBeenCalled();
        // a drag writes the model's nodes back, which come back as the same props: nothing to run
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
        expect(app.getNodes()).toBe(model.get("all-nodes"));
        expect(changed).toHaveBeenLastCalledWith(model.get("all-nodes"));
        expect(model.get("node-by", { id: "b" })?.position).toEqual({
            x: 50,
            y: 200,
        });
    });

    it("take a deep $state list (proxies) as plain data", async () => {
        const flow = createFlowRef();
        const { container, component } = await render(ControlledFlow, {
            flowRef: flow,
            deep: true,
            initialNodes: [task("a"), task("b", 0, 200)],
        });
        (component as unknown as Controlled).pushNode(task("c", 300));
        await settle();
        expect(part(container, "node", "c")).toBeInTheDocument();
        const held = flow.current?.model.get("node-by", { id: "c" });
        expect(Object.isFrozen(held)).toBe(true);
        expect(held?.position).toEqual({ x: 300, y: 0 });
        // the model's frozen lists, written back into the deep $state
        flow.current?.model.run("node.move", {
            nodeId: "a",
            position: { x: 20, y: 0 },
        });
        await settle();
        const app = component as unknown as Controlled;
        expect(
            app.getNodes()?.find((node) => node.id === "a")?.position,
        ).toEqual({ x: 20, y: 0 });
        expect(part(container, "node", "a").style.transform).toBe(
            "translate(20px, 0px)",
        );
        // the list written back stays the app's to change in place
        app.pushNode(task("d", 0, 400));
        await settle();
        expect(app.getNodes()?.map((node) => node.id)).toEqual([
            "a",
            "b",
            "c",
            "d",
        ]);
        expect(part(container, "node", "d")).toBeInTheDocument();
        flow.current?.model.run("node.move", {
            nodeId: "d",
            position: { x: 5, y: 400 },
        });
        await settle();
        expect(app.getNodes()?.at(-1)?.position).toEqual({ x: 5, y: 400 });
    });

    it("move, remove and connect locked nodes: the props are the app's document", async () => {
        const changed = vi.fn();
        const fixed = task("a", 0, 0, { draggable: false, deletable: false });
        const other = task("b", 0, 200);
        const { container, rerender } = await render(TestFlow, {
            nodes: [fixed, other],
            onnodeschange: changed,
        });
        await rerender({
            nodes: [{ ...fixed, position: { x: 9, y: 9 } }, other],
        });
        expect(part(container, "node", "a").style.transform).toBe(
            "translate(9px, 9px)",
        );
        await rerender({ nodes: [other] });
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
        const { container, rerender } = await render(TestFlow, {
            model,
            nodes: start,
            onnodeschange: changed,
        });
        await rerender({
            nodes: [
                { ...(start[0] as FlowNode), position: { x: 9, y: 9 } },
                task("b", 300),
            ],
        });
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
        const { rerender } = await render(TestFlow, {
            features: [subflows()],
            nodes: [parent, child],
            onnodeschange: changed,
        });
        await rerender({
            nodes: [parent, { ...child, position: { x: -50, y: 10 } }],
        });
        const reported = changed.mock.calls.at(-1)?.[0] as readonly FlowNode[];
        expect(reported.find((node) => node.id === "c")?.position).toEqual({
            x: 0,
            y: 10,
        });
    });

    it("leave the edges the app does not control to the model: a removed node takes its own", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const all = [task("a"), task("b", 0, 200)];
        const { container, rerender } = await render(TestFlow, {
            nodes: all,
            defaultEdges: [{ id: "ab", source: "a", target: "b" }],
        });
        expect(part(container, "edge", "ab")).toBeInTheDocument();
        await rerender({ nodes: [all[0] as FlowNode] });
        expect(container.querySelector('[data-flow-part="edge"]')).toBeNull();
        expect(warn).not.toHaveBeenCalled();
    });

    it("controls the edges too (bind:edges), and works over a model the app gives", async () => {
        const model = createFlowModel({
            version: 1,
            nodes: [task("a"), task("b", 0, 200)],
            edges: [],
        }) as unknown as FlowModel;
        const { container, component } = await render(ControlledFlow, {
            model,
            initialEdges: [],
        });
        const app = component as unknown as Controlled;
        app.setEdges([{ id: "ab", source: "a", target: "b" } as FlowEdge]);
        await settle();
        expect(model.get("all-edges").map((edge) => edge.id)).toEqual(["ab"]);
        expect(part(container, "edge", "ab")).toBeInTheDocument();
        app.setEdges([]);
        await settle();
        expect(container.querySelector('[data-flow-part="edge"]')).toBeNull();
    });

    it("brings a model the app gives to the props it starts with", async () => {
        const model = createFlowModel({
            version: 1,
            nodes: [task("a")],
            edges: [],
        }) as unknown as FlowModel;
        const { container } = await render(TestFlow, {
            model,
            nodes: [task("a", 40, 0)],
        });
        expect(model.get("node-by", { id: "a" })?.position).toEqual({
            x: 40,
            y: 0,
        });
        expect(part(container, "node", "a").style.transform).toBe(
            "translate(40px, 0px)",
        );
    });

    it("an uncontrolled root reads defaultNodes once", async () => {
        const { container, rerender } = await render(TestFlow, {
            defaultNodes: [task("a", 0)],
        });
        await rerender({ defaultNodes: [task("a", 100)] });
        expect(part(container, "node", "a").style.transform).toBe(
            "translate(0px, 0px)",
        );
    });

    it("another model gets another engine, the flow ref and the facade following it", async () => {
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
        const flow = createFlowRef();
        const { container, rerender } = await render(TestFlow, {
            model: first,
            flowRef: flow,
        });
        expect(part(container, "node", "a")).toBeInTheDocument();
        const engine = flow.current?.engine;
        await rerender({ model: second });
        expect(container.querySelector('[data-flow-id="a"]')).toBeNull();
        expect(part(container, "node", "b").style.transform).toBe(
            "translate(0px, 200px)",
        );
        expect(part(container, "root").style.touchAction).toBe("none");
        expect(flow.current?.model).toBe(second);
        // the same facade, now over the new engine
        expect(flow.current?.engine).toBe(engine);
        expect(
            flow.current?.engine.get("node-rect-by", { nodeId: "b" }),
        ).toMatchObject({ y: 200 });
    });
});
