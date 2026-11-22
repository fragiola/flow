// The render levels (`render-layers`, `zIndexMode`), the static geometry of the first client
// render and its hydration, and an edge's focus kept across levels.
import type { AnyTypes, FlowEdgeInput, FlowNodeInput } from "@fragiola/flow";
import { keyboard } from "@fragiola/flow/keyboard";
import { selection } from "@fragiola/flow/selection";
import { act, render } from "@testing-library/react";
import * as React from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFlowRef } from "../src/index";
import {
    declaredPair,
    installLayout,
    part,
    settle,
    TestFlow,
    task,
} from "./flow";

beforeEach(() => {
    installLayout();
});

afterEach(() => {
    vi.restoreAllMocks();
});

const features = [selection(), keyboard()] as const;

function three(selected: boolean): {
    nodes: FlowNodeInput[];
    edges: FlowEdgeInput[];
} {
    return {
        nodes: [task("a"), task("b", 0, 200), task("c", 200, 200)],
        edges: [
            { id: "ab", source: "a", target: "b" },
            { id: "ac", source: "a", target: "c", selected },
        ],
    };
}

const layers = (container: ParentNode) => [
    ...container.querySelectorAll<HTMLElement>(
        '[data-flow-part="edges-layer"]',
    ),
];

describe("render levels", () => {
    it("keeps today's DOM with one level: one SVG of edges, the nodes layer isolated", async () => {
        const { nodes, edges } = three(false);
        const { container } = render(
            <TestFlow
                features={features}
                defaultNodes={nodes}
                defaultEdges={edges}
                label
            />,
        );
        await settle();
        expect(layers(container)).toHaveLength(0);
        const outer = part(container, "edges");
        expect(outer.tagName).toBe("DIV");
        const svg = outer.children[0] as Element;
        expect(svg.tagName.toLowerCase()).toBe("svg");
        expect(svg.querySelectorAll('[data-flow-part="edge"]')).toHaveLength(2);
        // the labels in the edges' own HTML layer
        expect(
            [...outer.children].filter(
                (child) =>
                    child.getAttribute("data-flow-part") === "edge-label",
            ),
        ).toHaveLength(2);
        expect(part(container, "nodes").style.isolation).toBe("isolate");
    });

    it("draws a selected edge (zIndexMode auto) in a level above the nodes, its label in that level", async () => {
        const { nodes, edges } = three(true);
        const { container } = render(
            <TestFlow
                features={features}
                defaultNodes={nodes}
                defaultEdges={edges}
                label
            />,
        );
        await settle();
        const [level0, level1] = layers(container);
        if (!level0 || !level1) throw new Error("two levels expected");
        expect(layers(container)).toHaveLength(2);
        expect(level0.getAttribute("data-level")).toBe("0");
        expect(level1.getAttribute("data-level")).toBe("1");
        for (const layer of [level0, level1]) {
            expect(layer.style.position).toBe("absolute");
            expect(layer.style.pointerEvents).toBe("none");
            expect(layer.style.overflow).toBe("visible");
            expect(layer.parentElement).toBe(part(container, "edges"));
        }
        const z = (element: HTMLElement) => Number(element.style.zIndex);
        // level 0's edges, then the nodes, then level 1's edges
        expect(z(level0)).toBeLessThan(z(part(container, "node", "a")));
        expect(z(part(container, "node", "a"))).toBeLessThan(z(level1));
        expect(z(level1)).toBeLessThan(0);
        expect(part(level0, "edge", "ab")).toBeTruthy();
        expect(part(level1, "edge", "ac")).toBeTruthy();
        expect(part(level0, "edge-label", "ab").parentElement).toBe(level0);
        expect(part(level1, "edge-label", "ac").parentElement).toBe(level1);
        expect(level1.querySelector('[data-flow-id="ab"]')).toBeNull();
        // the nodes interleave with the levels: no stacking context of their own, and never moved
        expect(part(container, "nodes").style.isolation).toBe("");
        expect(
            part(container, "node", "a").parentElement?.getAttribute(
                "data-flow-part",
            ),
        ).toBe("nodes");
    });

    it("goes back to one level when the edge is no longer selected, and keeps one with zIndexMode basic", async () => {
        const ref = createFlowRef<AnyTypes, typeof features>();
        const { nodes, edges } = three(true);
        const { container, rerender } = render(
            <TestFlow
                features={features}
                defaultNodes={nodes}
                defaultEdges={edges}
                flowRef={ref}
            />,
        );
        await settle();
        expect(layers(container)).toHaveLength(2);
        act(() => {
            ref.current?.model.run("selection.clear", {});
        });
        await settle();
        expect(layers(container)).toHaveLength(0);
        expect(part(container, "nodes").style.isolation).toBe("isolate");
        act(() => {
            ref.current?.model.run("selection.set", { edgeIds: ["ac"] });
        });
        await settle();
        expect(layers(container)).toHaveLength(2);
        rerender(
            <TestFlow
                features={features}
                defaultNodes={nodes}
                defaultEdges={edges}
                flowRef={ref}
                zIndexMode="basic"
            />,
        );
        await settle();
        expect(layers(container)).toHaveLength(0);
    });

    it("gives the focus back to an edge that moves to another level", async () => {
        const ref = createFlowRef<AnyTypes, typeof features>();
        const { nodes, edges } = three(false);
        const { container } = render(
            <TestFlow
                features={features}
                defaultNodes={nodes}
                defaultEdges={edges}
                flowRef={ref}
            />,
        );
        await settle();
        const before = part(container, "edge", "ac");
        act(() => {
            (before as unknown as HTMLElement).focus();
        });
        expect(document.activeElement).toBe(before);
        act(() => {
            ref.current?.model.run("selection.set", { edgeIds: ["ac"] });
        });
        await settle();
        const after = part(container, "edge", "ac");
        expect(after).not.toBe(before);
        expect(after.closest('[data-flow-part="edges-layer"]')).toBe(
            layers(container)[1],
        );
        expect(document.activeElement).toBe(after);
    });
});

describe("the first client render", () => {
    it("hydrates the server's output with no mismatch, and the engine keeps its paths", async () => {
        const { nodes, edges } = declaredPair();
        const flow = (
            <TestFlow
                features={features}
                defaultNodes={nodes}
                defaultEdges={edges}
                nodeOrigin={{ x: 0, y: 0 }}
            />
        );
        const html = renderToString(flow);
        const container = document.createElement("div");
        container.innerHTML = html;
        document.body.append(container);
        const serverPath = part(container, "edge-path", "ab").getAttribute("d");
        expect(serverPath).toMatch(/^M/);
        const errors = vi.spyOn(console, "error");
        const recoverable = vi.fn();
        const root = await act(async () =>
            hydrateRoot(container, flow, { onRecoverableError: recoverable }),
        );
        await settle();
        expect(recoverable).not.toHaveBeenCalled();
        expect(errors).not.toHaveBeenCalled();
        // measured as declared: the engine's path is the static one
        expect(part(container, "edge-path", "ab").getAttribute("d")).toBe(
            serverPath,
        );
        expect(part(container, "node", "b").style.transform).toBe(
            "translate(0px, 200px)",
        );
        act(() => root.unmount());
        container.remove();
    });

    it("draws the static geometry before the engine, as the server does", async () => {
        const { nodes, edges } = declaredPair();
        const server = renderToString(
            <TestFlow defaultNodes={nodes} defaultEdges={edges} />,
        );
        const serverPath = server.match(
            /data-flow-part="edge-path"[^>]* d="([^"]+)"/,
        )?.[1];
        // a child's layout effect runs before the root's, which creates the engine: it sees the
        // first client render
        const first: {
            d?: string | null;
            transform?: string;
            engine?: boolean;
        } = {};
        function Probe() {
            React.useLayoutEffect(() => {
                first.d = document
                    .querySelector('[data-flow-part="edge-path"]')
                    ?.getAttribute("d");
                first.transform = document.querySelector<HTMLElement>(
                    '[data-flow-part="node"][data-flow-id="b"]',
                )?.style.transform;
                // the engine's state attribute, absent from the static ones
                first.engine = document
                    .querySelector('[data-flow-part="root"]')
                    ?.hasAttribute("data-interactive");
            }, []);
            return null;
        }
        render(
            <TestFlow defaultNodes={nodes} defaultEdges={edges}>
                <Probe />
            </TestFlow>,
        );
        await settle();
        expect(serverPath).toMatch(/^M/);
        expect(first.engine).toBe(false);
        expect(part(document, "root").hasAttribute("data-interactive")).toBe(
            true,
        );
        expect(first.d).toBe(serverPath);
        expect(first.transform).toBe("translate(0px, 200px)");
    });
});
