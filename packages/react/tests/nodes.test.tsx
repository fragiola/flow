import { drag as dragFeature } from "@fragiola/flow/drag";
import { keyboard } from "@fragiola/flow/keyboard";
import { selection } from "@fragiola/flow/selection";
import { subflows } from "@fragiola/flow/subflows";
import { render } from "@testing-library/react";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    type AnyTypes,
    Flow,
    type FlowRef,
    useFlowRef,
    useNode,
} from "../src/index";
import {
    drag,
    installLayout,
    key,
    part,
    pointer,
    settle,
    TestFlow,
    task,
} from "./flow";

beforeEach(() => {
    installLayout();
});

describe("nodes", () => {
    it("keep their element when they move: no remount, only the moved node re-renders", async () => {
        const renders = vi.fn();
        const mounts = vi.fn();
        function Content({ id }: { id: string }) {
            renders(id);
            React.useEffect(() => {
                mounts(id);
            }, [id]);
            return <span data-flow-part="label" />;
        }
        const features = [selection(), dragFeature()] as const;
        const { container } = render(
            <Flow.Root
                features={features}
                defaultNodes={[task("a"), task("b", 0, 200)]}
            >
                <Flow.Viewport>
                    <Flow.Nodes>
                        {(node) => (
                            <Flow.Node node={node}>
                                <Content id={node.id} />
                            </Flow.Node>
                        )}
                    </Flow.Nodes>
                </Flow.Viewport>
            </Flow.Root>,
        );
        await settle();
        const before = part(container, "node", "a");
        renders.mockClear();
        mounts.mockClear();
        drag(before, part(container, "root"), [
            { clientX: 10, clientY: 10 },
            { clientX: 40, clientY: 30 },
            { clientX: 70, clientY: 50 },
        ]);
        await settle();
        const after = part(container, "node", "a");
        expect(after).toBe(before);
        expect(after.style.transform).toBe("translate(60px, 40px)");
        expect(mounts).not.toHaveBeenCalled();
        expect(renders.mock.calls.every(([id]) => id === "a")).toBe(true);
    });

    it("show the engine's state: selected on a tap, dragging during a drag", async () => {
        const features = [selection(), dragFeature()] as const;
        const { container } = render(
            <TestFlow features={features} defaultNodes={[task("a")]} />,
        );
        await settle();
        const node = part(container, "node", "a");
        pointer(node, "pointerdown", { clientX: 10, clientY: 10 });
        pointer(part(container, "root"), "pointerup", {
            clientX: 10,
            clientY: 10,
        });
        expect(node).toHaveAttribute("data-selected");
        pointer(node, "pointerdown", { clientX: 10, clientY: 10 });
        pointer(part(container, "root"), "pointermove", {
            clientX: 30,
            clientY: 10,
        });
        expect(node).toHaveAttribute("data-dragging");
        expect(part(container, "root")).toHaveAttribute("data-dragging");
        pointer(part(container, "root"), "pointerup", {
            clientX: 30,
            clientY: 10,
        });
        expect(node).not.toHaveAttribute("data-dragging");
    });

    it("take focus with keyboard(), and move with the arrows", async () => {
        const features = [selection(), keyboard()] as const;
        const { container } = render(
            <TestFlow features={features} defaultNodes={[task("a")]} />,
        );
        await settle();
        const node = part(container, "node", "a");
        expect(node.tabIndex).toBe(0);
        node.focus();
        key(node, "ArrowRight");
        expect(node.style.transform).toBe("translate(5px, 0px)");
    });

    it("are not focusable without keyboard()", async () => {
        const { container } = render(<TestFlow defaultNodes={[task("a")]} />);
        await settle();
        expect(part(container, "node", "a").hasAttribute("tabindex")).toBe(
            false,
        );
    });

    it("render flat at their absolute place with subflows()", async () => {
        const { container } = render(
            <TestFlow
                features={[subflows()]}
                defaultNodes={[
                    task("group", 100, 100, { width: 300, height: 300 }),
                    task("child", 20, 30, { parentId: "group" }),
                ]}
            />,
        );
        await settle();
        const child = part(container, "node", "child");
        expect(child.parentElement).toBe(part(container, "nodes"));
        expect(child.style.transform).toBe("translate(120px, 130px)");
    });

    it("can be rendered by hand with useNode", async () => {
        function MyNode({ node }: { node: Parameters<typeof useNode>[0] }) {
            const { state, props } = useNode(node);
            return <article {...props} data-x={state.x} />;
        }
        const { container } = render(
            <Flow.Root defaultNodes={[task("a", 7, 8)]}>
                <Flow.Viewport>
                    <Flow.Nodes>{(node) => <MyNode node={node} />}</Flow.Nodes>
                </Flow.Viewport>
            </Flow.Root>,
        );
        await settle();
        const node = part(container, "node", "a");
        expect(node.tagName.toLowerCase()).toBe("article");
        expect(node).toHaveAttribute("data-x", "7");
        expect(node).toHaveAttribute("data-measured");
    });

    it("show a toolbar outside the zoom while selected", async () => {
        const features = [selection()] as const;
        let flow: FlowRef<AnyTypes, typeof features> | undefined;
        function App() {
            const ref = useFlowRef<AnyTypes, typeof features>();
            flow = ref;
            return (
                <Flow.Root
                    flowRef={ref}
                    features={features}
                    defaultNodes={[task("a", 100, 100)]}
                    defaultViewport={{ x: 0, y: 0, zoom: 2 }}
                >
                    <Flow.Viewport>
                        <Flow.Nodes>
                            {(node) => (
                                <Flow.Node node={node}>
                                    <Flow.NodeToolbar data-testid="toolbar" />
                                </Flow.Node>
                            )}
                        </Flow.Nodes>
                    </Flow.Viewport>
                </Flow.Root>
            );
        }
        const { container, queryByTestId } = render(<App />);
        await settle();
        expect(queryByTestId("toolbar")).toBeNull();
        await settle();
        flow?.current?.model.run("selection.set", { nodeIds: ["a"] });
        await settle();
        const toolbar = queryByTestId("toolbar") as HTMLElement;
        expect(toolbar.parentElement).toBe(part(container, "root"));
        // the node's top centre at zoom 2: (100 + 50) × 2, 100 × 2, minus the offset
        expect(toolbar.style.transform).toBe(
            "translate(300px, 190px) translate(-50%, -100%)",
        );
    });
});
