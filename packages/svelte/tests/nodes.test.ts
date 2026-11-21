import { drag as dragFeature } from "@fragiola/flow/drag";
import { keyboard } from "@fragiola/flow/keyboard";
import { selection } from "@fragiola/flow/selection";
import { subflows } from "@fragiola/flow/subflows";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type AnyTypes, createFlowRef, type FlowNode } from "../src/index";
import HandFlow from "./fixtures/hand-flow.svelte";
import ProbeFlow from "./fixtures/probe-flow.svelte";
import TestFlow from "./fixtures/test-flow.svelte";
import {
    drag,
    installLayout,
    key,
    pair,
    part,
    pointer,
    render,
    settle,
    task,
} from "./flow";

beforeEach(() => {
    installLayout();
});

describe("nodes", () => {
    it("keep their element when they move: no remount, only the moved node renders again", async () => {
        const renders = vi.fn();
        const mounts = vi.fn();
        const features = [selection(), dragFeature()] as const;
        const { container } = await render(ProbeFlow, {
            features,
            defaultNodes: [task("a"), task("b", 0, 200)],
            onrender: (_kind: string, node: FlowNode) => renders(node.id),
            onmount: mounts,
        });
        expect(renders).toHaveBeenCalledWith("b");
        const before = part(container, "node", "a");
        renders.mockClear();
        mounts.mockClear();
        await drag(before, part(container, "root"), [
            { clientX: 10, clientY: 10 },
            { clientX: 40, clientY: 30 },
            { clientX: 70, clientY: 50 },
        ]);
        const after = part(container, "node", "a");
        expect(after).toBe(before);
        expect(after.style.transform).toBe("translate(60px, 40px)");
        expect(mounts).not.toHaveBeenCalled();
        expect(renders).toHaveBeenCalledWith("a");
        expect(renders.mock.calls.every(([id]) => id === "a")).toBe(true);
    });

    it("register their element once: a move or a selection observes nothing again", async () => {
        const calls: string[] = [];
        class Observer {
            observe(element: Element) {
                calls.push(`observe ${element.getAttribute("data-flow-id")}`);
            }
            unobserve(element: Element) {
                calls.push(`unobserve ${element.getAttribute("data-flow-id")}`);
            }
            disconnect() {}
        }
        vi.stubGlobal("ResizeObserver", Observer);
        const features = [selection(), dragFeature()] as const;
        const { container } = await render(TestFlow, {
            features,
            defaultNodes: [task("a"), task("b", 0, 200)],
        });
        expect(calls).toContain("observe a");
        calls.length = 0;
        const node = part(container, "node", "a");
        const root = part(container, "root");
        await pointer(node, "pointerdown", { clientX: 10, clientY: 10 });
        await pointer(root, "pointerup", { clientX: 10, clientY: 10 });
        await drag(node, root, [
            { clientX: 10, clientY: 10 },
            { clientX: 40, clientY: 30 },
            { clientX: 70, clientY: 50 },
        ]);
        expect(node.style.transform).toBe("translate(60px, 40px)");
        expect(calls).toEqual([]);
        vi.unstubAllGlobals();
    });

    it("render again with a value the snippet reads, and with a new snippet (Vue's #11 bug)", async () => {
        const { nodes, edges } = pair();
        const { container, rerender } = await render(ProbeFlow, {
            defaultNodes: nodes,
            defaultEdges: edges,
        });
        expect(part(container, "node", "a")).toHaveAttribute(
            "data-mark",
            "off",
        );
        expect(part(container, "edge", "ab")).toHaveAttribute(
            "data-mark",
            "off",
        );
        await rerender({ mark: "on" });
        expect(part(container, "node", "a")).toHaveAttribute("data-mark", "on");
        expect(part(container, "node", "b")).toHaveAttribute("data-mark", "on");
        expect(part(container, "edge", "ab")).toHaveAttribute(
            "data-mark",
            "on",
        );
        // another snippet renders every node with it
        await rerender({ alt: true });
        expect(part(container, "node", "a")).toHaveAttribute(
            "data-snippet",
            "b",
        );
        expect(part(container, "node", "b")).toHaveAttribute(
            "data-snippet",
            "b",
        );
        expect(part(container, "node", "b")).toHaveAttribute("data-mark", "on");
    });

    it("show the engine's state: selected on a tap, dragging during a drag", async () => {
        const features = [selection(), dragFeature()] as const;
        const { container } = await render(TestFlow, {
            features,
            defaultNodes: [task("a")],
        });
        const node = part(container, "node", "a");
        const root = part(container, "root");
        await pointer(node, "pointerdown", { clientX: 10, clientY: 10 });
        await pointer(root, "pointerup", { clientX: 10, clientY: 10 });
        expect(node).toHaveAttribute("data-selected");
        await pointer(node, "pointerdown", { clientX: 10, clientY: 10 });
        await pointer(root, "pointermove", { clientX: 30, clientY: 10 });
        expect(node).toHaveAttribute("data-dragging");
        expect(root).toHaveAttribute("data-dragging");
        await pointer(root, "pointerup", { clientX: 30, clientY: 10 });
        expect(node).not.toHaveAttribute("data-dragging");
    });

    it("take focus with keyboard(), and move with the arrows", async () => {
        const features = [selection(), keyboard()] as const;
        const { container } = await render(TestFlow, {
            features,
            defaultNodes: [task("a")],
        });
        const node = part(container, "node", "a");
        expect(node.tabIndex).toBe(0);
        node.focus();
        await key(node, "ArrowRight");
        expect(node.style.transform).toBe("translate(5px, 0px)");
    });

    it("are not focusable without keyboard()", async () => {
        const { container } = await render(TestFlow, {
            defaultNodes: [task("a")],
        });
        expect(part(container, "node", "a").hasAttribute("tabindex")).toBe(
            false,
        );
    });

    it("render flat at their absolute place with subflows()", async () => {
        const { container } = await render(TestFlow, {
            features: [subflows()],
            defaultNodes: [
                task("group", 100, 100, { width: 300, height: 300 }),
                task("child", 20, 30, { parentId: "group" }),
            ],
        });
        const child = part(container, "node", "child");
        expect(child.parentElement).toBe(part(container, "nodes"));
        expect(child.style.transform).toBe("translate(120px, 130px)");
    });

    it("can be rendered by hand with useNode", async () => {
        const { container } = await render(HandFlow, {
            hand: true,
            defaultNodes: [task("a", 7, 8)],
        });
        const node = part(container, "node", "a");
        expect(node.tagName.toLowerCase()).toBe("article");
        expect(node).toHaveAttribute("data-x", "7");
        expect(node).toHaveAttribute("data-measured");
    });

    it("show a toolbar outside the zoom while selected", async () => {
        const features = [selection()] as const;
        const flow = createFlowRef<AnyTypes, typeof features>();
        const { container } = await render(HandFlow, {
            flowRef: flow,
            features,
            defaultNodes: [task("a", 100, 100)],
            defaultViewport: { x: 0, y: 0, zoom: 2 },
        });
        const toolbar = () =>
            container.querySelector<HTMLElement>('[data-testid="toolbar"]');
        expect(toolbar()).toBeNull();
        flow.current?.model.run("selection.set", { nodeIds: ["a"] });
        await settle();
        expect(toolbar()?.parentElement).toBe(part(container, "root"));
        // the node's top centre at zoom 2: (100 + 50) × 2, 100 × 2, minus the offset
        expect(toolbar()?.style.transform).toBe(
            "translate(300px, 190px) translate(-50%, -100%)",
        );
        flow.current?.model.run("selection.clear", {});
        await settle();
        expect(toolbar()).toBeNull();
    });
});
