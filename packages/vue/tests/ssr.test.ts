// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createSSRApp, h } from "vue";
import { renderToString } from "vue/server-renderer";
import { pair, TestFlow } from "./flow";

// a server render, like the first client render, has no engine yet: the nodes are there at their
// place, with their part attributes; edges wait for the engine's measurements
describe("a render with no engine", () => {
    it("renders the root, the viewport and the nodes at their place", async () => {
        const html = await renderToString(
            createSSRApp({
                render: () =>
                    h(TestFlow, {
                        defaultNodes: pair().nodes,
                        defaultEdges: pair().edges,
                    }),
            }),
        );
        expect(html).toContain('data-flow-part="root"');
        expect(html).toContain('data-flow-part="viewport"');
        expect(html).toMatch(/data-flow-part="node" data-flow-id="b"/);
        expect(html).toContain("translate(0px, 200px)");
        expect(html).not.toContain('data-flow-part="edge"');
    });
});
