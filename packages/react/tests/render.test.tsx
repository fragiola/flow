import { render } from "@testing-library/react";
import { StrictMode } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { installLayout, pair, part, settle, TestFlow, task } from "./flow";

beforeEach(() => {
    installLayout();
});

describe("rendering a flow", () => {
    it("renders the root, the viewport, every node and, once measured, every edge", async () => {
        const { container } = render(
            <TestFlow
                defaultNodes={pair().nodes}
                defaultEdges={pair().edges}
                label
            />,
        );
        await settle();
        expect(part(container, "root")).toBeInTheDocument();
        expect(part(container, "viewport")).toBeInTheDocument();
        expect(part(container, "node", "a")).toBeInTheDocument();
        expect(part(container, "node", "b")).toBeInTheDocument();
        const edge = part(container, "edge", "ab");
        expect(edge.tagName.toLowerCase()).toBe("g");
        const path = part(edge, "edge-path");
        // from a's bottom centre (50, 40) to b's top centre (50, 200)
        expect(path.getAttribute("d")).toMatch(/^M ?50[ ,]40/);
        expect(part(container, "edge-label", "ab")).toHaveTextContent("ab");
        expect(
            container.querySelectorAll('[data-flow-part="handle"]'),
        ).toHaveLength(4);
    });

    it("positions each node with a structural transform at its place, with the document's size", async () => {
        const { container } = render(
            <TestFlow defaultNodes={[task("a", 30, 70)]} />,
        );
        await settle();
        const node = part(container, "node", "a");
        expect(node.style.position).toBe("absolute");
        expect(node.style.transform).toBe("translate(30px, 70px)");
        expect(node.style.width).toBe("100px");
        expect(node).toHaveAttribute("data-measured");
    });

    it("draws no edge before both its nodes have a size", async () => {
        const { container } = render(
            <TestFlow
                defaultNodes={[
                    {
                        id: "a",
                        type: "task",
                        position: { x: 0, y: 0 },
                        data: {},
                    },
                    task("b", 0, 200),
                ]}
                defaultEdges={[{ id: "ab", source: "a", target: "b" }]}
            />,
        );
        await settle();
        expect(container.querySelector('[data-flow-part="edge"]')).toBeNull();
    });

    it("leaves hidden nodes out", async () => {
        const { container } = render(
            <TestFlow
                defaultNodes={[task("a"), task("b", 0, 0, { hidden: true })]}
            />,
        );
        await settle();
        expect(container.querySelector('[data-flow-id="b"]')).toBeNull();
    });

    it("mounts once under StrictMode: one engine attached, the nodes registered", async () => {
        const { container } = render(
            <StrictMode>
                <TestFlow
                    defaultNodes={pair().nodes}
                    defaultEdges={pair().edges}
                />
            </StrictMode>,
        );
        await settle();
        expect(part(container, "root").style.touchAction).toBe("none");
        expect(part(container, "viewport").style.transform).toBe(
            "translate(0px, 0px) scale(1)",
        );
        expect(part(container, "edge", "ab")).toBeInTheDocument();
    });
});
