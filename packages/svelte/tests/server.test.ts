// @vitest-environment node
import { render } from "svelte/server";
import { describe, expect, it } from "vitest";
import TestFlow from "./fixtures/test-flow.svelte";
import { pair } from "./flow";

// a server render, like the first client render, has no engine yet: the nodes are there at their
// place, with their part attributes; edges wait for the engine's measurements
describe("a render with no engine", () => {
    it("renders the root, the viewport and the nodes at their place", () => {
        const { body } = render(TestFlow, {
            props: {
                defaultNodes: pair().nodes,
                defaultEdges: pair().edges,
                label: true,
            },
        });
        expect(body).toContain('data-flow-part="root"');
        expect(body).toContain('data-flow-part="viewport"');
        expect(body).toMatch(/data-flow-part="node" data-flow-id="b"/);
        expect(body).toContain("translate(0px, 200px)");
        expect(body).not.toContain('data-flow-part="edge"');
        expect(body).not.toContain("touch-action");
    });
});
