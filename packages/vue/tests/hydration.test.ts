// The client takes over the server's HTML: the first client render has no engine either, so it
// draws the same static geometry (the same edge paths, the same node places) and hydrates without
// a mismatch; then the engine takes over.
import { selection } from "@fragiola/flow/selection";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, createSSRApp, h } from "vue";
import { renderToString } from "vue/server-renderer";
import { declared, installLayout, pair, settle, TestFlow, task } from "./flow";

beforeEach(() => {
    installLayout();
});

/** The flows the server renders: declared handles and sizes, and one with two levels. */
const FLOWS: Record<string, () => Record<string, unknown>> = {
    "declared handles and sizes": () => ({
        defaultNodes: declared().nodes,
        defaultEdges: declared().edges,
    }),
    "a node origin": () => ({
        defaultNodes: [
            task("a", 100, 100, { origin: { x: 0.5, y: 0.5 } }),
            task("b", 300, 300),
        ],
        defaultEdges: [{ id: "ab", source: "a", target: "b" }],
    }),
    "a selected edge above the nodes": () => ({
        features: [selection()],
        defaultNodes: [...pair().nodes, task("c", 200, 200)],
        defaultEdges: [
            ...pair().edges,
            { id: "ac", source: "a", target: "c", selected: true },
        ],
    }),
};

/** The paths and node transforms of a rendered flow. */
function geometryOf(root: ParentNode) {
    return {
        paths: [...root.querySelectorAll('[data-flow-part="edge-path"]')].map(
            (path) => path.getAttribute("d"),
        ),
        nodes: [
            ...root.querySelectorAll<HTMLElement>('[data-flow-part="node"]'),
        ].map((node) => node.style.transform),
        layers: root.querySelectorAll('[data-flow-part="edges-layer"]').length,
    };
}

describe("hydrating the server's HTML", () => {
    for (const [name, props] of Object.entries(FLOWS)) {
        it(`shows no mismatch, with ${name}`, async () => {
            const html = await renderToString(
                createSSRApp({ render: () => h(TestFlow, props()) }),
            );
            expect(html).toContain('data-flow-part="edge-path"');
            const host = document.createElement("div");
            host.innerHTML = html;
            document.body.append(host);
            const server = geometryOf(host);
            const warnings: string[] = [];
            const error = vi
                .spyOn(console, "error")
                .mockImplementation((...args: unknown[]) => {
                    warnings.push(args.map(String).join(" "));
                });
            const warn = vi
                .spyOn(console, "warn")
                .mockImplementation((...args: unknown[]) => {
                    warnings.push(args.map(String).join(" "));
                });
            const app = createSSRApp({ render: () => h(TestFlow, props()) });
            app.config.warnHandler = (message) => warnings.push(message);
            app.mount(host);
            // hydrated: the server's elements kept as they were
            expect(geometryOf(host)).toEqual(server);
            await settle();
            expect(
                warnings.filter((w) => /hydration|mismatch/i.test(w)),
            ).toEqual([]);
            // the engine took over: the edges are still drawn
            expect(
                host.querySelectorAll('[data-flow-part="edge-path"]').length,
            ).toBe(server.paths.length);
            app.unmount();
            error.mockRestore();
            warn.mockRestore();
        });
    }

    it("draws the first client render (before the engine) as the server does", async () => {
        const props = FLOWS["declared handles and sizes"];
        if (!props) throw new Error("no flow");
        const html = await renderToString(
            createSSRApp({ render: () => h(TestFlow, props()) }),
        );
        const server = document.createElement("div");
        server.innerHTML = html;
        const host = document.createElement("div");
        document.body.append(host);
        const app = createApp({ render: () => h(TestFlow, props()) });
        app.mount(host);
        // mounted, before Vue patches what the engine (created on mount) gives
        expect(geometryOf(host)).toEqual(geometryOf(server));
        expect(geometryOf(host).paths[0]).toMatch(/^M100,20 /);
        app.unmount();
    });
});
