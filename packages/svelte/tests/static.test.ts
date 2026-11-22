// Before the engine and the render levels (#39): the first client render draws the static geometry
// (the server's very output: hydration keeps its elements and warns of no mismatch), the engine
// then draws the same, and edges standing above nodes render as level wrappers. The server HTML
// comes from a Vite server's SSR build of the same fixture (`svelte/server` in Node), hydrated here.

import { resolve } from "node:path";
import { type FlowEdge, type FlowNode, staticGeometry } from "@fragiola/flow";
import { keyboard } from "@fragiola/flow/keyboard";
import { selection } from "@fragiola/flow/selection";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { flushSync, hydrate, mount, unmount } from "svelte";
import {
    createServer,
    defaultClientConditions,
    defaultServerConditions,
    type ViteDevServer,
} from "vite";
import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";
import { withSourceCondition } from "../../../scripts/source-condition.ts";
import TestFlow from "./fixtures/test-flow.svelte";
import { installLayout, part, render, settle, task } from "./flow";

let vite: ViteDevServer;

beforeAll(async () => {
    vite = await createServer({
        configFile: false,
        root: resolve(import.meta.dirname, ".."),
        logLevel: "silent",
        plugins: [svelte()],
        resolve: { conditions: withSourceCondition(defaultClientConditions) },
        ssr: {
            resolve: {
                conditions: withSourceCondition(defaultServerConditions),
            },
        },
        server: { middlewareMode: true, hmr: false, ws: false, watch: null },
        appType: "custom",
    });
}, 30_000);

afterAll(async () => {
    await vite?.close();
});

beforeEach(() => {
    installLayout();
});

/** The fixture rendered on the server (`svelte/server` in Node, as an app's SSR). */
async function serverHtml(props: Record<string, unknown>): Promise<string> {
    const server = (await vite.ssrLoadModule("svelte/server")) as {
        render: (component: unknown, options: unknown) => { body: string };
    };
    const fixture = (await vite.ssrLoadModule(
        "/tests/fixtures/test-flow.svelte",
    )) as { default: unknown };
    return server.render(fixture.default, { props }).body;
}

/** Two nodes declaring their size and handles: `a`'s source on its bottom, `b`'s target on top. */
function declared(): { nodes: FlowNode[]; edges: FlowEdge[] } {
    const node = (id: string, x: number, y: number) =>
        ({
            id,
            type: "task",
            position: { x, y },
            data: {},
            width: 100,
            height: 40,
            handles: [
                { type: "source", position: "bottom", x: 50, y: 40 },
                { type: "target", position: "top", x: 50, y: 0 },
            ],
        }) as FlowNode;
    return {
        nodes: [node("a", 0, 0), node("b", 150, 200)],
        edges: [{ id: "ab", source: "a", target: "b" } as FlowEdge],
    };
}

const pathOf = (container: ParentNode, edgeId: string) =>
    part(container, "edge-path", edgeId).getAttribute("d");

describe("before the engine", () => {
    it("draws the static geometry in the first client render, and the engine draws the same", async () => {
        const flow = declared();
        const target = document.body.appendChild(document.createElement("div"));
        const app = mount(TestFlow, {
            target,
            props: { defaultNodes: flow.nodes, defaultEdges: flow.edges },
        });
        // mounted, its effects not run yet: no engine
        expect(part(target, "root").style.touchAction).toBe("");
        const expected = staticGeometry(flow).edgePaths.ab?.path;
        expect(expected).toMatch(/^M50,40 /);
        expect(pathOf(target, "ab")).toBe(expected);
        expect(part(target, "node", "b").style.transform).toBe(
            "translate(150px, 200px)",
        );
        await settle();
        expect(part(target, "root").style.touchAction).toBe("none");
        expect(pathOf(target, "ab")).toBe(expected);
        await unmount(app);
    });

    it("hydrates the server HTML with no mismatch: the same elements, the edges drawn", async () => {
        const flow = declared();
        const props = {
            features: [selection()],
            defaultNodes: [...flow.nodes, task("c", 300, 0)],
            defaultEdges: [
                ...flow.edges,
                { id: "ac", source: "a", target: "c", selected: true },
            ],
            label: true,
        };
        const html = await serverHtml(props);
        expect(html).toContain('data-flow-part="edges-layer"');
        const target = document.body.appendChild(document.createElement("div"));
        target.innerHTML = html;
        const path = part(target, "edge-path", "ab");
        const node = part(target, "node", "b");
        const warn = vi.spyOn(console, "warn");
        const error = vi.spyOn(console, "error");
        const app = hydrate(TestFlow, { target, props: props as never });
        flushSync();
        await settle();
        const messages = [...warn.mock.calls, ...error.mock.calls].flat();
        expect(messages.join("\n")).not.toMatch(/hydration|mismatch/i);
        // the server's elements are kept (a mismatch would render them again)
        expect(part(target, "edge-path", "ab")).toBe(path);
        expect(part(target, "node", "b")).toBe(node);
        expect(path.getAttribute("d")).toBe(
            staticGeometry(flow).edgePaths.ab?.path,
        );
        await unmount(app);
    });
});

describe("the render levels", () => {
    const flow = () => ({
        features: [selection(), keyboard()],
        nodes: [task("a"), task("b", 0, 200), task("c", 200, 200)],
        edges: (selected: boolean): FlowEdge[] => [
            { id: "ab", source: "a", target: "b", selected } as FlowEdge,
            { id: "bc", source: "b", target: "c" } as FlowEdge,
        ],
    });

    it("keeps today's DOM with one level", async () => {
        const { features, nodes, edges } = flow();
        const { container } = await render(TestFlow, {
            features,
            nodes,
            edges: edges(false),
            label: true,
        });
        const layer = part(container, "edges");
        expect(container.querySelector('[data-flow-part="edges-layer"]')).toBe(
            null,
        );
        // its SVG, then the two labels
        expect(layer.children).toHaveLength(3);
        expect(layer.firstElementChild?.tagName.toLowerCase()).toBe("svg");
        expect(part(container, "edge-label", "ab").parentElement).toBe(layer);
        expect(part(container, "nodes").style.isolation).toBe("isolate");
    });

    it("renders a wrapper per level when an edge stands above nodes, its labels inside, and back", async () => {
        const { features, nodes, edges } = flow();
        const { container, rerender } = await render(TestFlow, {
            features,
            nodes,
            edges: edges(true),
            label: true,
        });
        const levels = [
            ...container.querySelectorAll<HTMLElement>(
                '[data-flow-part="edges-layer"]',
            ),
        ];
        expect(levels.map((level) => level.dataset.level)).toEqual(["0", "1"]);
        for (const level of levels) {
            expect(level.parentElement).toBe(part(container, "edges"));
            expect(level.style.position).toBe("absolute");
            expect(level.style.pointerEvents).toBe("none");
            expect(Number(level.style.zIndex)).toBeLessThan(0);
            expect(
                level.querySelector(':scope > svg[data-flow-part="edges"]'),
            ).not.toBe(null);
        }
        const [below, above] = levels as [HTMLElement, HTMLElement];
        expect(part(above, "edge", "ab")).toBeTruthy();
        expect(part(below, "edge", "bc")).toBeTruthy();
        expect(part(container, "edge-label", "ab").parentElement).toBe(above);
        expect(part(container, "edge-label", "bc").parentElement).toBe(below);
        // the nodes interleave with the levels, each at its z-index
        expect(part(container, "nodes").style.isolation).toBe("");
        expect(Number(part(container, "node", "a").style.zIndex)).toBeLessThan(
            Number(above.style.zIndex),
        );
        await rerender({ edges: edges(false) });
        expect(container.querySelector('[data-flow-part="edges-layer"]')).toBe(
            null,
        );
        expect(part(container, "edge-label", "ab").parentElement).toBe(
            part(container, "edges"),
        );
        expect(part(container, "nodes").style.isolation).toBe("isolate");
    });

    it("gives a focused edge its focus back when it moves to another level (adapter.refocus)", async () => {
        const { features, nodes, edges } = flow();
        const { container, rerender } = await render(TestFlow, {
            features,
            nodes,
            edges: edges(false),
        });
        const before = part(container, "edge", "ab");
        before.focus();
        expect(document.activeElement).toBe(before);
        await rerender({ edges: edges(true) });
        const after = part(container, "edge", "ab");
        expect(after).not.toBe(before);
        expect(after.closest('[data-flow-part="edges-layer"]')).not.toBe(null);
        expect(document.activeElement).toBe(after);
    });
});
