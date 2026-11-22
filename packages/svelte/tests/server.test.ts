// @vitest-environment node
import { type FlowEdge, type FlowNode, staticGeometry } from "@fragiola/flow";
import { selection } from "@fragiola/flow/selection";
import { render } from "svelte/server";
import { describe, expect, it } from "vitest";
import TestFlow from "./fixtures/test-flow.svelte";
import { pair, task } from "./flow";

const serverRender = (props: Record<string, unknown>) =>
    render(TestFlow, { props }).body;

/** Two nodes declaring their size and handles (no `width` / `height`): `a`'s source on its right. */
function declared(): { nodes: FlowNode[]; edges: FlowEdge[] } {
    const node = (id: string, x: number, y: number) =>
        ({
            id,
            type: "task",
            position: { x, y },
            data: {},
            initialWidth: 100,
            initialHeight: 40,
            handles: [
                { type: "source", position: "right", x: 100, y: 20 },
                { type: "target", position: "left", x: 0, y: 20 },
            ],
        }) as FlowNode;
    return {
        nodes: [node("a", 0, 0), node("b", 300, 100)],
        edges: [{ id: "ab", source: "a", target: "b" } as FlowEdge],
    };
}

// a server render, like the first client render, has no engine yet: the nodes and the edges are
// the static geometry's (`staticGeometry`, the very functions the engine falls back to)
describe("a render with no engine", () => {
    it("renders the root, the viewport, the nodes at their place and the edges of sized nodes", () => {
        const flow = pair();
        const body = serverRender({
            defaultNodes: flow.nodes,
            defaultEdges: flow.edges,
            label: true,
        });
        expect(body).toContain('data-flow-part="root"');
        expect(body).toContain('data-flow-part="viewport"');
        expect(body).toMatch(/data-flow-part="node" data-flow-id="b"/);
        expect(body).toContain("translate(0px, 200px)");
        expect(body).toMatch(/data-flow-part="edge" data-flow-id="ab"/);
        const path = staticGeometry(flow).edgePaths.ab?.path;
        expect(path).toMatch(/^M/);
        expect(body).toContain(`d="${path}"`);
        expect(body).not.toContain("touch-action");
        // one level: today's DOM
        expect(body).not.toContain('data-flow-part="edges-layer"');
        expect(body).toContain("isolation: isolate");
    });

    it("waits for the engine to draw an edge whose nodes have no size", () => {
        const body = serverRender({
            defaultNodes: [
                { id: "a", type: "task", position: { x: 0, y: 0 }, data: {} },
                { id: "b", type: "task", position: { x: 0, y: 200 }, data: {} },
            ],
            defaultEdges: pair().edges,
        });
        expect(body).toMatch(/data-flow-part="node" data-flow-id="b"/);
        expect(body).not.toContain('data-flow-part="edge"');
    });

    it("draws the edges from the declared sizes and handles", () => {
        const flow = declared();
        const body = serverRender({
            defaultNodes: flow.nodes,
            defaultEdges: flow.edges,
        });
        const path = staticGeometry(flow).edgePaths.ab?.path;
        // from `a`'s right handle to `b`'s left one
        expect(path).toMatch(/^M100,20 /);
        expect(body).toContain(`d="${path}"`);
        expect(body).toContain("translate(300px, 100px)");
    });

    it("places each node by its own origin, else the root's", () => {
        const body = serverRender({
            defaultNodes: [
                task("a", 200, 100, { origin: { x: 0.5, y: 0.5 } }),
                task("b", 200, 100),
            ],
            nodeOrigin: { x: 1, y: 0 },
        });
        expect(body).toMatch(
            /data-flow-id="a" style="[^"]*translate\(150px, 80px\)/,
        );
        expect(body).toMatch(
            /data-flow-id="b" style="[^"]*translate\(100px, 100px\)/,
        );
    });

    it("renders the render levels: a selected edge above the nodes (zIndexMode auto)", () => {
        const flow = pair();
        const props = {
            features: [selection()],
            defaultNodes: [...flow.nodes, task("c", 200, 200)],
            defaultEdges: [
                { id: "ab", source: "a", target: "b", selected: true },
                { id: "bc", source: "b", target: "c" },
            ],
        };
        const body = serverRender(props);
        const geometry = staticGeometry({
            nodes: props.defaultNodes,
            edges: props.defaultEdges as FlowEdge[],
        });
        expect(geometry.layers.length).toBe(2);
        for (const layer of geometry.layers) {
            expect(body).toContain(
                `<div data-flow-part="edges-layer" data-level="${layer.level}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; z-index: ${layer.zIndex}">`,
            );
        }
        // the nodes interleave with the levels: no stacking context of their own
        expect(body).not.toContain("isolation: isolate");
        expect(body).toMatch(
            /data-level="1"[^>]*>(?:(?!data-level).)*data-flow-id="ab"/,
        );
        // basic: one level, today's DOM
        const basic = serverRender({ ...props, zIndexMode: "basic" });
        expect(basic).not.toContain("edges-layer");
        expect(basic).toContain("isolation: isolate");
    });
});
