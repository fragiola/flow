import { drag as dragFeature } from "@fragiola/flow/drag";
import { keyboard } from "@fragiola/flow/keyboard";
import { selection } from "@fragiola/flow/selection";
import { subflows } from "@fragiola/flow/subflows";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type AnyTypes, createFlowRef, type FlowNode } from "../src/public-api";
import { HandFlow, ProbeFlow, TestFlow } from "./fixtures";
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
    it("keep their element when they move: no new view, only the moved node renders again", async () => {
        const renders = vi.fn();
        const mounts = vi.fn();
        const features = [selection(), dragFeature()] as const;
        const { container } = await render(ProbeFlow, {
            features,
            defaultNodes: [task("a"), task("b", 0, 200)],
            onRender: (_kind: string, node: FlowNode) => renders(node.id),
            onMount: mounts,
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

    it("render again with a value the template reads, and with another template (Vue's #11 bug)", async () => {
        const { nodes, edges } = pair();
        const { container, set } = await render(ProbeFlow, {
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
        await set({ mark: "on" });
        expect(part(container, "node", "a")).toHaveAttribute("data-mark", "on");
        expect(part(container, "node", "b")).toHaveAttribute("data-mark", "on");
        expect(part(container, "edge", "ab")).toHaveAttribute(
            "data-mark",
            "on",
        );
        // another template renders every node with it
        await set({ alt: true });
        expect(part(container, "node", "a")).toHaveAttribute(
            "data-template",
            "b",
        );
        expect(part(container, "node", "b")).toHaveAttribute(
            "data-template",
            "b",
        );
        expect(part(container, "node", "b")).toHaveAttribute("data-mark", "on");
        expect(
            container.querySelectorAll('[data-flow-part="node"]'),
        ).toHaveLength(2);
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

    it("show a move before the next task: an arrow's step is on screen after a microtask (#16)", async () => {
        const features = [selection(), keyboard()] as const;
        const { container } = await render(TestFlow, {
            features,
            defaultNodes: [task("a")],
        });
        const node = part(container, "node", "a");
        node.focus();
        node.dispatchEvent(
            new KeyboardEvent("keydown", {
                key: "ArrowDown",
                bubbles: true,
                cancelable: true,
            }),
        );
        // zoneless Angular renders in a later task; the root renders the flow's change sooner, so
        // whatever reads the page right after the key (a test, an assistive technology) sees it
        await Promise.resolve();
        await Promise.resolve();
        expect(node.style.transform).toBe("translate(0px, 5px)");
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

    it("can be rendered by hand with injectNode, and its handles with injectHandle", async () => {
        const flow = createFlowRef();
        const { container } = await render(HandFlow, {
            hand: true,
            flowRef: flow,
            defaultNodes: [task("a", 7, 8)],
        });
        const node = part(container, "node", "a");
        expect(node.tagName.toLowerCase()).toBe("article");
        expect(node).toHaveAttribute("data-x", "7");
        expect(node).toHaveAttribute("data-measured");
        expect(node.style.transform).toBe("translate(7px, 8px)");
        const handle = part(node, "handle");
        expect(handle.tagName.toLowerCase()).toBe("span");
        expect(handle).toHaveAttribute("data-handle-type", "source");
        expect(handle.style.top).toBe("100%");
        expect(
            flow.current?.engine.get("handles-by", { nodeId: "a" }),
        ).toHaveLength(1);
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
