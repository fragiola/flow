// @vitest-environment node
import { selection } from "@fragiola/flow/selection";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { declaredPair, pair, TestFlow, task } from "./flow";

// a server render, like the first client render, has no engine yet: the parts draw the document's
// static geometry (`staticGeometry`): the nodes at their place (origin applied), the edges whose
// nodes have a size, by render level
describe("a render with no engine", () => {
    it("renders the root, the viewport and the nodes at their place", () => {
        const html = renderToString(
            <TestFlow
                defaultNodes={pair().nodes}
                defaultEdges={pair().edges}
            />,
        );
        expect(html).toContain('data-flow-part="root"');
        expect(html).toContain('data-flow-part="viewport"');
        expect(html).toMatch(/data-flow-part="node" data-flow-id="b"/);
        expect(html).toContain("translate(0px, 200px)");
    });

    it("draws the edges of nodes with a declared size, at their declared handles", () => {
        const { nodes, edges } = declaredPair();
        const html = renderToString(
            <TestFlow defaultNodes={nodes} defaultEdges={edges} />,
        );
        expect(html).toMatch(/data-flow-part="edge" data-flow-id="ab"/);
        // from a's bottom handle (50, 40) to b's top one (50, 200)
        expect(html).toMatch(/data-flow-part="edge-path"[^>]* d="M ?50[ ,]40/);
        // one level: today's DOM, the nodes layer its own stacking context
        expect(html).not.toContain('data-flow-part="edges-layer"');
        expect(html).toMatch(
            /data-flow-part="nodes" style="[^"]*isolation:isolate/,
        );
    });

    it("gives the edge parts data-selected and data-animated from the document, as the engine does", () => {
        const html = renderToString(
            <TestFlow
                defaultNodes={[task("a"), task("b", 0, 200)]}
                defaultEdges={[
                    { id: "ab", source: "a", target: "b", animated: true },
                ]}
                zIndexMode="basic"
            />,
        );
        expect(html).toMatch(
            /data-flow-part="edge" data-flow-id="ab"[^>]* data-animated=""/,
        );
        expect(html).toMatch(
            /data-flow-part="edge-path" data-flow-id="ab"[^>]* data-animated=""/,
        );
        expect(html).not.toContain("data-selected");
    });

    it("draws no edge while one of its nodes has no size", () => {
        const html = renderToString(
            <TestFlow
                defaultNodes={[
                    task("a"),
                    {
                        id: "b",
                        type: "task",
                        position: { x: 0, y: 200 },
                        data: {},
                    },
                ]}
                defaultEdges={[{ id: "ab", source: "a", target: "b" }]}
            />,
        );
        expect(html).not.toContain('data-flow-part="edge"');
        expect(html).toMatch(/data-flow-part="node" data-flow-id="b"/);
    });

    it("places a node by its own origin, over the root's nodeOrigin", () => {
        const html = renderToString(
            <TestFlow
                defaultNodes={[
                    task("a", 200, 100),
                    task("b", 200, 300, { origin: { x: 1, y: 1 } }),
                ]}
                nodeOrigin={{ x: 0.5, y: 0.5 }}
            />,
        );
        expect(html).toContain("translate(150px, 80px)");
        expect(html).toContain("translate(100px, 260px)");
    });

    it("draws a selected edge in a level of its own above the nodes (zIndexMode auto)", () => {
        const html = renderToString(
            <TestFlow
                features={[selection()]}
                defaultNodes={[
                    task("a"),
                    task("b", 0, 200),
                    task("c", 200, 200),
                ]}
                defaultEdges={[
                    { id: "ab", source: "a", target: "b" },
                    { id: "ac", source: "a", target: "c", selected: true },
                ]}
            />,
        );
        expect(html.match(/data-flow-part="edges-layer"/g)).toHaveLength(2);
        expect(html).toContain('data-level="0"');
        expect(html).toContain('data-level="1"');
        expect(html).not.toMatch(
            /data-flow-part="nodes" style="[^"]*isolation:isolate/,
        );
        // the viewport is a stacking context before the engine: the negative ranks stay in it
        expect(html).toMatch(
            /data-flow-part="viewport" style="[^"]*isolation:isolate/,
        );
        const level1 = html.slice(html.indexOf('data-level="1"'));
        expect(level1).toContain('data-flow-id="ac"');
        expect(level1).not.toContain('data-flow-id="ab"');
    });

    it("keeps one level with zIndexMode basic", () => {
        const html = renderToString(
            <TestFlow
                features={[selection()]}
                zIndexMode="basic"
                defaultNodes={[task("a"), task("b", 0, 200)]}
                defaultEdges={[
                    { id: "ab", source: "a", target: "b", selected: true },
                ]}
            />,
        );
        expect(html).not.toContain('data-flow-part="edges-layer"');
        expect(html).toMatch(/data-flow-part="edge" data-flow-id="ab"/);
    });
});
