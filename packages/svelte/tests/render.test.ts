import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFlowModel, createFlowRef, type FlowModel } from "../src/index";
import TestFlow from "./fixtures/test-flow.svelte";
import { installLayout, pair, part, render, task } from "./flow";

beforeEach(() => {
    installLayout();
});

describe("rendering a flow", () => {
    it("renders the root, the viewport, every node and, once measured, every edge", async () => {
        const { container } = await render(TestFlow, {
            defaultNodes: pair().nodes,
            defaultEdges: pair().edges,
            label: true,
        });
        expect(part(container, "root")).toBeInTheDocument();
        expect(part(container, "viewport")).toBeInTheDocument();
        expect(part(container, "node", "a")).toBeInTheDocument();
        expect(part(container, "node", "b")).toBeInTheDocument();
        const edge = part(container, "edge", "ab");
        expect(edge.tagName.toLowerCase()).toBe("g");
        expect(edge.namespaceURI).toBe("http://www.w3.org/2000/svg");
        const path = part(edge, "edge-path");
        // from a's bottom centre (50, 40) to b's top centre (50, 200)
        expect(path.getAttribute("d")).toMatch(/^M ?50[ ,]40/);
        const label = part(container, "edge-label", "ab");
        expect(label).toHaveTextContent("ab");
        // an HTML element in the edges' HTML layer, not in the SVG
        expect(label.namespaceURI).toBe("http://www.w3.org/1999/xhtml");
        expect(label.parentElement).toBe(part(container, "edges"));
        expect(
            container.querySelectorAll('[data-flow-part="handle"]'),
        ).toHaveLength(4);
    });

    it("positions each node with a structural transform at its place, with the document's size", async () => {
        const { container } = await render(TestFlow, {
            defaultNodes: [task("a", 30, 70)],
        });
        const node = part(container, "node", "a");
        expect(node.style.position).toBe("absolute");
        expect(node.style.transform).toBe("translate(30px, 70px)");
        expect(node.style.width).toBe("100px");
        expect(node).toHaveAttribute("data-measured");
    });

    it("draws no edge before both its nodes have a size", async () => {
        const { container } = await render(TestFlow, {
            defaultNodes: [
                { id: "a", type: "task", position: { x: 0, y: 0 }, data: {} },
                task("b", 0, 200),
            ],
            defaultEdges: [{ id: "ab", source: "a", target: "b" }],
        });
        expect(container.querySelector('[data-flow-part="edge"]')).toBeNull();
    });

    it("leaves hidden nodes out", async () => {
        const { container } = await render(TestFlow, {
            defaultNodes: [task("a"), task("b", 0, 0, { hidden: true })],
        });
        expect(container.querySelector('[data-flow-id="b"]')).toBeNull();
    });

    it("attaches one engine: the root, the viewport and the nodes", async () => {
        const { container, unmount } = await render(TestFlow, {
            defaultNodes: pair().nodes,
            defaultEdges: pair().edges,
        });
        expect(part(container, "root").style.touchAction).toBe("none");
        expect(part(container, "viewport").style.transform).toBe(
            "translate(0px, 0px) scale(1)",
        );
        expect(part(container, "edge", "ab")).toBeInTheDocument();
        unmount();
        expect(container.querySelector('[data-flow-part="root"]')).toBeNull();
    });

    it("releases everything on unmount: the engine, the model's listeners, the flow ref and the labels it mounted", async () => {
        const model = createFlowModel({
            version: 1,
            ...pair(),
        }) as unknown as FlowModel;
        const flow = createFlowRef();
        const onnodeschange = vi.fn();
        const { container, unmount } = await render(TestFlow, {
            model,
            flowRef: flow,
            onnodeschange,
            label: true,
        });
        expect(part(container, "edge-label", "ab")).toBeInTheDocument();
        const engine = flow.current?.engine;
        expect(engine?.get("viewport")).toEqual({ x: 0, y: 0, zoom: 1 });
        unmount();
        expect(flow.current).toBeNull();
        expect(document.querySelector("[data-flow-part]")).toBeNull();
        // the facade an app may still hold forwards to no engine: its actions are refused
        expect(engine?.run("fit-view").ok).toBe(false);
        // the model outlives the root, which no longer listens to it
        expect(
            model.run("node.move", { nodeId: "a", position: { x: 10, y: 10 } })
                .ok,
        ).toBe(true);
        expect(onnodeschange).not.toHaveBeenCalled();
    });
});
