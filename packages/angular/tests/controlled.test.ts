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
} from "../src/public-api";
import { ControlledFlow, TestFlow } from "./fixtures";
import { drag, installLayout, part, render, settle, task } from "./flow";

beforeEach(() => {
    installLayout();
});

const features = [selection(), dragFeature()] as const;

describe("controlled nodes and edges ([(nodes)], [(edges)])", () => {
    it("bring the model to the inputs with commands, and give every change of the model back", async () => {
        const commits: CommandEvent[] = [];
        const changed = vi.fn();
        const flow = createFlowRef();
        const { container, component } = await render(ControlledFlow, {
            flowRef: flow,
            features,
            initialNodes: [task("a"), task("b", 0, 200)],
            initialEdges: [],
            onNodesChange: changed,
        });
        const model = flow.current?.model as FlowModel;
        model.subscribe((event) => commits.push(event));
        // the app moves a node and adds one: node.move and node.add, marked as the inputs'
        component.list.set([
            task("a", 30, 0),
            task("b", 0, 200),
            task("c", 300),
        ]);
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
        // a drag gives the model's nodes back, which come back as the same input: nothing to run
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
        expect(component.list()).toBe(model.get("all-nodes"));
        expect(changed).toHaveBeenLastCalledWith(model.get("all-nodes"));
        expect(model.get("node-by", { id: "b" })?.position).toEqual({
            x: 50,
            y: 200,
        });
    });

    it("give the model's frozen lists back, and take the app's lists as plain data", async () => {
        const flow = createFlowRef();
        const { container, component } = await render(ControlledFlow, {
            flowRef: flow,
            initialNodes: [task("a"), task("b", 0, 200)],
        });
        const mine = task("c", 300);
        component.list.set([...(component.list() ?? []), mine]);
        await settle();
        expect(part(container, "node", "c")).toBeInTheDocument();
        const held = flow.current?.model.get("node-by", { id: "c" });
        expect(Object.isFrozen(held)).toBe(true);
        expect(held).not.toBe(mine);
        // the model's list, given back into the app's signal
        flow.current?.model.run("node.move", {
            nodeId: "a",
            position: { x: 20, y: 0 },
        });
        await settle();
        expect(Object.isFrozen(component.list())).toBe(true);
        expect(
            component.list()?.find((node) => node.id === "a")?.position,
        ).toEqual({ x: 20, y: 0 });
        expect(part(container, "node", "a").style.transform).toBe(
            "translate(20px, 0px)",
        );
        // and the app makes its next list from it
        component.list.set([...(component.list() ?? []), task("d", 0, 400)]);
        await settle();
        expect(component.list()?.map((node) => node.id)).toEqual([
            "a",
            "b",
            "c",
            "d",
        ]);
        expect(part(container, "node", "d")).toBeInTheDocument();
    });

    it("move, remove and connect locked nodes: the inputs are the app's document", async () => {
        const changed = vi.fn();
        const fixed = task("a", 0, 0, { draggable: false, deletable: false });
        const other = task("b", 0, 200);
        const { container, set } = await render(TestFlow, {
            nodes: [fixed, other],
            onNodesChange: changed,
        });
        await set({
            nodes: [{ ...fixed, position: { x: 9, y: 9 } }, other],
        });
        expect(part(container, "node", "a").style.transform).toBe(
            "translate(9px, 9px)",
        );
        await set({ nodes: [other] });
        expect(container.querySelector('[data-flow-id="a"]')).toBeNull();
        expect(changed).not.toHaveBeenCalled();
    });

    it("report what the model holds when a middleware refuses an input", async () => {
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
        const { container, set } = await render(TestFlow, {
            model,
            nodes: start,
            onNodesChange: changed,
        });
        await set({
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

    it("report what the model holds when a rule changed the inputs (a child kept in its parent)", async () => {
        const changed = vi.fn();
        const parent = task("p", 0, 0, { width: 200, height: 200 });
        const child = task("c", 10, 10, { parentId: "p", extent: "parent" });
        const { set } = await render(TestFlow, {
            features: [subflows()],
            nodes: [parent, child],
            onNodesChange: changed,
        });
        await set({
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
        const { container, set } = await render(TestFlow, {
            nodes: all,
            defaultEdges: [{ id: "ab", source: "a", target: "b" }],
        });
        expect(part(container, "edge", "ab")).toBeInTheDocument();
        await set({ nodes: [all[0] as FlowNode] });
        expect(container.querySelector('[data-flow-part="edge"]')).toBeNull();
        expect(warn).not.toHaveBeenCalled();
    });

    it("controls the edges too ([(edges)]), and works over a model the app gives", async () => {
        const model = createFlowModel({
            version: 1,
            nodes: [task("a"), task("b", 0, 200)],
            edges: [],
        }) as unknown as FlowModel;
        const { container, component } = await render(ControlledFlow, {
            model,
            initialEdges: [],
        });
        component.links.set([
            { id: "ab", source: "a", target: "b" } as FlowEdge,
        ]);
        await settle();
        expect(model.get("all-edges").map((edge) => edge.id)).toEqual(["ab"]);
        expect(part(container, "edge", "ab")).toBeInTheDocument();
        component.links.set([]);
        await settle();
        expect(container.querySelector('[data-flow-part="edge"]')).toBeNull();
    });

    it("brings a model the app gives to the inputs it starts with", async () => {
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
        const { container, set } = await render(TestFlow, {
            defaultNodes: [task("a", 0)],
        });
        await set({ defaultNodes: [task("a", 100)] });
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
        const { container, set } = await render(TestFlow, {
            model: first,
            flowRef: flow,
            defaultViewport: { x: 5, y: 0, zoom: 1 },
        });
        expect(part(container, "node", "a")).toBeInTheDocument();
        const engine = flow.current?.engine;
        flow.current?.engine.run("pan-by", { x: 10, y: 0 });
        await set({ model: second });
        expect(container.querySelector('[data-flow-id="a"]')).toBeNull();
        expect(part(container, "node", "b").style.transform).toBe(
            "translate(0px, 200px)",
        );
        expect(part(container, "root").style.touchAction).toBe("none");
        expect(flow.current?.model).toBe(second);
        // the same facade, now over the new engine, at the last viewport
        expect(flow.current?.engine).toBe(engine);
        expect(flow.current?.engine.get("viewport")).toEqual({
            x: 15,
            y: 0,
            zoom: 1,
        });
        expect(
            flow.current?.engine.get("node-rect-by", { nodeId: "b" }),
        ).toMatchObject({ y: 200 });
    });
});
