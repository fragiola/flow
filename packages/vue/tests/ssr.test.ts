// @vitest-environment node
// A server render has no engine (the first client render neither): the parts draw from the static
// geometry of the document (`staticGeometry`), so the HTML holds the nodes at their place and the
// edges of every node whose size the document gives.
import { selection } from "@fragiola/flow/selection";
import { describe, expect, it } from "vitest";
import { createSSRApp, h } from "vue";
import { renderToString } from "vue/server-renderer";
import { staticGeometry } from "../src/index";
import { declared, pair, TestFlow, task } from "./flow";

function serverRender(props: Record<string, unknown>): Promise<string> {
    return renderToString(createSSRApp({ render: () => h(TestFlow, props) }));
}

describe("a render with no engine", () => {
    it("renders the root, the viewport, the nodes at their place and the edges between them", async () => {
        const html = await serverRender({
            defaultNodes: pair().nodes,
            defaultEdges: pair().edges,
        });
        expect(html).toContain('data-flow-part="root"');
        expect(html).toContain('data-flow-part="viewport"');
        expect(html).toMatch(/data-flow-part="node" data-flow-id="b"/);
        expect(html).toContain("translate(0px, 200px)");
        // the default sides: from a's bottom to b's top
        expect(html).toMatch(
            /<g data-flow-part="edge" data-flow-id="ab"[^>]*><!--\[--><path data-flow-part="edge-path" data-flow-id="ab" d="M50,40 [^"]+" fill="none">/,
        );
        // one level: today's layers, no edges-layer
        expect(html).not.toContain("edges-layer");
        expect(html).toContain("isolation:isolate");
    });

    it("draws the edge from the declared handles and an initial size, as staticGeometry does", async () => {
        const flow = declared();
        const html = await serverRender({
            defaultNodes: flow.nodes,
            defaultEdges: flow.edges,
        });
        const path = staticGeometry(flow).edgePaths.ab?.path;
        expect(path).toMatch(/^M100,20 /);
        expect(html).toContain(`d="${path}"`);
        expect(html).toContain("translate(300px, 100px)");
    });

    it("leaves out an edge whose node has no known size", async () => {
        const flow = declared();
        const html = await serverRender({
            defaultNodes: [
                flow.nodes[0],
                {
                    id: "b",
                    type: "task",
                    position: { x: 300, y: 100 },
                    data: {},
                },
            ],
            defaultEdges: flow.edges,
        });
        expect(html).toMatch(/data-flow-part="node" data-flow-id="b"/);
        expect(html).not.toContain('data-flow-part="edge"');
    });

    it("places a node by its own origin, or the root's nodeOrigin", async () => {
        const centred = await serverRender({
            defaultNodes: [task("a", 100, 100, { origin: { x: 0.5, y: 0.5 } })],
        });
        expect(centred).toContain("translate(50px, 80px)");
        const rooted = await serverRender({
            defaultNodes: [task("a", 100, 100)],
            nodeOrigin: { x: 1, y: 1 },
        });
        expect(rooted).toContain("translate(0px, 60px)");
    });

    it("renders a selected edge in its own level above the nodes (auto zIndexMode)", async () => {
        const flow = pair();
        const html = await serverRender({
            features: [selection()],
            defaultNodes: [...flow.nodes, task("c", 200, 200)],
            defaultEdges: [
                ...flow.edges,
                { id: "ac", source: "a", target: "c", selected: true },
            ],
        });
        const layers = [
            ...html.matchAll(
                /<div data-flow-part="edges-layer" data-level="(\d+)" style="([^"]*)">/g,
            ),
        ];
        expect(layers.map((match) => match[1])).toEqual(["0", "1"]);
        for (const [, , style] of layers) {
            expect(style).toMatch(
                /position:absolute;top:0;left:0;width:100%;height:100%;overflow:visible;pointer-events:none;z-index:-\d+;/,
            );
        }
        // each level's own svg, the selected edge in the upper one
        const upper = html.slice(html.indexOf('data-level="1"'));
        expect(upper).toMatch(/^[^>]*><svg data-flow-part="edges"/);
        expect(upper).toMatch(/data-flow-id="ac"/);
        expect(upper.indexOf('data-flow-id="ab"')).toBe(-1);
        expect(html).not.toContain("isolation:isolate");
        // the static z-indexes: the nodes between the two levels
        expect(html).toMatch(/data-flow-id="a"[^>]*z-index:-\d+;/);
    });

    it("keeps one level in the basic zIndexMode", async () => {
        const flow = pair();
        const html = await serverRender({
            features: [selection()],
            zIndexMode: "basic",
            defaultNodes: [...flow.nodes, task("c", 200, 200)],
            defaultEdges: [
                ...flow.edges,
                { id: "ac", source: "a", target: "c", selected: true },
            ],
        });
        expect(html).not.toContain("edges-layer");
        expect(html).toContain('data-flow-id="ac"');
        expect(html).toContain("isolation:isolate");
    });
});
