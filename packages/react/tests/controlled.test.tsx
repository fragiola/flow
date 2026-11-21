import { drag as dragFeature } from "@fragiola/flow/drag";
import { selection } from "@fragiola/flow/selection";
import { subflows } from "@fragiola/flow/subflows";
import { act, render } from "@testing-library/react";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    type CommandEvent,
    createFlowModel,
    type FlowEdge,
    type FlowModel,
    type FlowNode,
    useFlowRef,
    veto,
} from "../src/index";
import { drag, installLayout, part, settle, TestFlow, task } from "./flow";

beforeEach(() => {
    installLayout();
});

const features = [selection(), dragFeature()] as const;

describe("controlled nodes and edges", () => {
    it("bring the model to the props with commands, and report every change of the model", async () => {
        const commits: CommandEvent[] = [];
        let setNodes: (nodes: readonly FlowNode[]) => void = () => {};
        let flowModel: FlowModel | undefined;
        function App() {
            const [nodes, set] = React.useState<readonly FlowNode[]>([
                task("a") as FlowNode,
                task("b", 0, 200) as FlowNode,
            ]);
            const [edges, setEdges] = React.useState<readonly FlowEdge[]>([]);
            setNodes = set;
            const ref = useFlowRef();
            React.useEffect(() => {
                const model = ref.current?.model as FlowModel | undefined;
                flowModel = model;
                return model?.subscribe((event) => commits.push(event));
            }, [ref.current]);
            return (
                <TestFlow
                    flowRef={ref}
                    features={features}
                    nodes={nodes}
                    onNodesChange={set}
                    edges={edges}
                    onEdgesChange={setEdges}
                />
            );
        }
        const { container } = render(<App />);
        await settle();
        // the app moves a node and adds one: node.move and node.add, marked as the props'
        act(() =>
            setNodes([
                task("a", 30, 0) as FlowNode,
                task("b", 0, 200) as FlowNode,
                task("c", 300) as FlowNode,
            ]),
        );
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
        drag(part(container, "node", "b"), part(container, "root"), [
            { clientX: 10, clientY: 210 },
            { clientX: 60, clientY: 210 },
        ]);
        await settle();
        expect(part(container, "node", "b").style.transform).toBe(
            "translate(50px, 200px)",
        );
        expect(
            commits
                .slice(count)
                .every((event) => event.meta?.source !== "controlled"),
        ).toBe(true);
        expect(flowModel?.get("node-by", { id: "b" })?.position).toEqual({
            x: 50,
            y: 200,
        });
    });

    it("move, remove and connect locked nodes: the props are the app's document", async () => {
        const changed = vi.fn();
        function App({ nodes }: { nodes: readonly FlowNode[] }) {
            return <TestFlow nodes={nodes} onNodesChange={changed} />;
        }
        const fixed = task("a", 0, 0, {
            draggable: false,
            deletable: false,
        }) as FlowNode;
        const other = task("b", 0, 200) as FlowNode;
        const { rerender, container } = render(<App nodes={[fixed, other]} />);
        await settle();
        rerender(
            <App nodes={[{ ...fixed, position: { x: 9, y: 9 } }, other]} />,
        );
        await settle();
        expect(part(container, "node", "a").style.transform).toBe(
            "translate(9px, 9px)",
        );
        rerender(<App nodes={[other]} />);
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
        function App({ nodes }: { nodes: readonly FlowNode[] }) {
            return (
                <TestFlow model={model} nodes={nodes} onNodesChange={changed} />
            );
        }
        const start = model.get("all-nodes");
        const { rerender, container } = render(<App nodes={start} />);
        await settle();
        rerender(
            <App
                nodes={[
                    { ...(start[0] as FlowNode), position: { x: 9, y: 9 } },
                    task("b", 300) as FlowNode,
                ]}
            />,
        );
        await settle();
        expect(part(container, "node", "a").style.transform).toBe(
            "translate(0px, 0px)",
        );
        // what could be made was: b is there; the app hears the model's nodes
        expect(part(container, "node", "b")).toBeInTheDocument();
        expect(changed).toHaveBeenLastCalledWith(model.get("all-nodes"));
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });

    it("report what the model holds when a rule changed the props (a child kept in its parent)", async () => {
        const changed = vi.fn();
        const parent = task("p", 0, 0, { width: 200, height: 200 }) as FlowNode;
        const child = task("c", 10, 10, {
            parentId: "p",
            extent: "parent",
        }) as FlowNode;
        function App({ nodes }: { nodes: readonly FlowNode[] }) {
            return (
                <TestFlow
                    features={[subflows()]}
                    nodes={nodes}
                    onNodesChange={changed}
                />
            );
        }
        const { rerender } = render(<App nodes={[parent, child]} />);
        await settle();
        rerender(
            <App nodes={[parent, { ...child, position: { x: -50, y: 10 } }]} />,
        );
        await settle();
        const reported = changed.mock.calls.at(-1)?.[0] as readonly FlowNode[];
        expect(reported.find((node) => node.id === "c")?.position).toEqual({
            x: 0,
            y: 10,
        });
    });

    it("leave the edges the app does not control to the model: a removed node takes its own", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        function App({ nodes }: { nodes: readonly FlowNode[] }) {
            return (
                <TestFlow
                    nodes={nodes}
                    defaultEdges={[{ id: "ab", source: "a", target: "b" }]}
                />
            );
        }
        const nodes = [task("a") as FlowNode, task("b", 0, 200) as FlowNode];
        const { rerender, container } = render(<App nodes={nodes} />);
        await settle();
        expect(part(container, "edge", "ab")).toBeInTheDocument();
        rerender(<App nodes={[nodes[0] as FlowNode]} />);
        await settle();
        expect(container.querySelector('[data-flow-part="edge"]')).toBeNull();
        expect(warn).not.toHaveBeenCalled();
        warn.mockRestore();
    });

    it("controls the edges too, and works over a model the app gives", async () => {
        const model = createFlowModel({
            version: 1,
            nodes: [task("a"), task("b", 0, 200)],
            edges: [],
        }) as unknown as FlowModel;
        function App({ edges }: { edges: readonly FlowEdge[] }) {
            return <TestFlow model={model} edges={edges} />;
        }
        const { rerender, container } = render(<App edges={[]} />);
        await settle();
        rerender(<App edges={[{ id: "ab", source: "a", target: "b" }]} />);
        await settle();
        expect(model.get("all-edges").map((edge) => edge.id)).toEqual(["ab"]);
        expect(part(container, "edge", "ab")).toBeInTheDocument();
        rerender(<App edges={[]} />);
        await settle();
        expect(container.querySelector('[data-flow-part="edge"]')).toBeNull();
    });

    it("an uncontrolled root reads defaultNodes once", async () => {
        function App({ x }: { x: number }) {
            return <TestFlow defaultNodes={[task("a", x)]} />;
        }
        const { rerender, container } = render(<App x={0} />);
        await settle();
        rerender(<App x={100} />);
        await settle();
        expect(part(container, "node", "a").style.transform).toBe(
            "translate(0px, 0px)",
        );
    });
});
