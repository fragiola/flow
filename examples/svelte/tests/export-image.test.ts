// @vitest-environment node
import type { FlowEdge, FlowNode } from "@fragiola/flow-svelte";
import { describe, expect, it } from "vitest";
import {
    boundsOf,
    DEFAULT_LOOK,
    escapeXml,
    flowSvg,
    pointsOf,
} from "../src/examples/export-image/flow-svg";

// The export-image example's SVG builder, run where a server runs it: in node, no DOM. A flow of
// declared sizes gives a path per edge and a rectangle and label per node, in a viewBox fitted to
// the nodes plus the padding, every text escaped.

const node = (
    id: string,
    x: number,
    y: number,
    extra: Partial<FlowNode> = {},
): FlowNode =>
    ({
        id,
        type: "step",
        position: { x, y },
        width: 100,
        height: 40,
        data: { label: id },
        ...extra,
    }) as FlowNode;

const edge = (id: string, source: string, target: string, type?: string) =>
    ({ id, source, target, ...(type ? { type } : {}) }) as FlowEdge;

const flow = {
    nodes: [node("a", 0, 0), node("b", 200, 100), node("c", 400, 0)],
    edges: [
        edge("a-b", "a", "b"),
        edge("b-c", "b", "c", "smoothstep"),
        edge("a-c", "a", "c", "straight"),
    ],
};

const count = (markup: string, pattern: RegExp) =>
    markup.match(pattern)?.length ?? 0;

describe("flowSvg, outside a browser", () => {
    it("draws a path per edge and a shape and a label per node", () => {
        const { markup } = flowSvg(flow);
        expect(typeof document).toBe("undefined");
        expect(
            markup.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'),
        ).toBe(true);
        expect(count(markup, /<path [^>]*d="M[^"]+"/g)).toBe(3);
        expect(count(markup, /<rect data-id=/g)).toBe(3);
        expect(count(markup, /<text /g)).toBe(3);
        for (const id of ["a-b", "b-c", "a-c"]) {
            expect(markup).toContain(`<path data-id="${id}"`);
        }
    });

    it("fits the viewBox to the nodes plus the padding", () => {
        const two = { nodes: flow.nodes, edges: [edge("a-b", "a", "b")] };
        const svg = flowSvg(two, { padding: 10 });
        // nodes from (0, 0) to (500, 140)
        expect(svg.markup).toContain('viewBox="-10 -10 520 160"');
        expect(svg.markup).toContain('width="520" height="160"');
        expect([svg.width, svg.height]).toEqual([520, 160]);
        expect(flowSvg(two).width).toBe(500 + 48);
    });

    it("widens the viewBox to a step edge that turns outside the nodes", () => {
        // b-c goes down to 160 and up to -20 around the nodes
        const svg = flowSvg(flow, { padding: 10 });
        expect(svg.markup).toContain('viewBox="-10 -30 520 200"');
    });

    it("places each shape at its node's box and its label at the centre", () => {
        const { markup } = flowSvg(flow);
        expect(markup).toContain(
            '<rect data-id="b" x="200" y="100" width="100" height="40"',
        );
        expect(markup).toContain('<text data-id="b" x="250" y="120">b</text>');
        // a straight edge from a's bottom side to c's top side (the default sides), at their middles
        expect(markup).toContain('<path data-id="a-c" d="M50,40 L450,0"/>');
    });

    it("escapes the labels and the look's values", () => {
        const { markup } = flowSvg(
            {
                nodes: [
                    node("x", 0, 0, {
                        data: { label: `<b>"Tom" & 'Jerry'</b>` },
                    }),
                ],
                edges: [],
            },
            { look: { fontFamily: `"Times New Roman", serif` } },
        );
        expect(markup).toContain(
            "&lt;b&gt;&quot;Tom&quot; &amp; &apos;Jerry&apos;&lt;/b&gt;",
        );
        expect(markup).toContain(
            'font-family="&quot;Times New Roman&quot;, serif"',
        );
        expect(markup).not.toContain("<b>");
        expect(escapeXml("a<b>&")).toBe("a&lt;b&gt;&amp;");
    });

    it("leaves out hidden nodes, nodes of unknown size and their edges", () => {
        const { markup } = flowSvg({
            nodes: [
                node("a", 0, 0),
                node("hidden", 200, 0, { hidden: true }),
                node("unsized", 400, 0, {
                    width: undefined,
                    height: undefined,
                }),
            ],
            edges: [
                edge("a-hidden", "a", "hidden"),
                edge("a-unsized", "a", "unsized"),
            ],
        });
        expect(count(markup, /<rect data-id=/g)).toBe(1);
        expect(count(markup, /<path /g)).toBe(0);
    });

    it("uses the default look unless told, and a transparent canvas on request", () => {
        const plain = flowSvg(flow).markup;
        expect(plain).toContain(
            `<rect x="-24" y="-44" width="548" height="228" fill="${DEFAULT_LOOK.background}"/>`,
        );
        expect(plain).toContain(`stroke="${DEFAULT_LOOK.edgeStroke}"`);
        expect(plain).not.toContain("stroke-dasharray");
        const themed = flowSvg(flow, {
            look: {
                background: "none",
                edgeStroke: "rgb(1, 2, 3)",
                edgeDash: "6, 4",
            },
        }).markup;
        expect(themed).not.toContain("<rect x=");
        expect(themed).toContain('stroke="rgb(1, 2, 3)"');
        expect(themed).toContain('stroke-dasharray="6, 4"');
    });

    it("takes a node's text from labelOf", () => {
        const { markup } = flowSvg(flow, {
            labelOf: (n) => n.id.toUpperCase(),
        });
        expect(markup).toContain(">A</text>");
    });
});

describe("pointsOf", () => {
    it("reads every point of an absolute path", () => {
        expect(
            pointsOf("M50,40 C50,70 250,70 250,100").map(({ x, y }) => [x, y]),
        ).toEqual([
            [50, 40],
            [50, 70],
            [250, 70],
            [250, 100],
        ]);
        expect(pointsOf("M-1.5 2e1 L 3,4")[0]).toEqual({
            x: -1.5,
            y: 20,
            width: 0,
            height: 0,
        });
    });
});

describe("boundsOf", () => {
    it("is the box around the given ones, empty at the origin for none", () => {
        expect(
            boundsOf([
                { x: 10, y: 20, width: 30, height: 40 },
                { x: -5, y: 50, width: 10, height: 10 },
            ]),
        ).toEqual({ x: -5, y: 20, width: 45, height: 40 });
        expect(boundsOf([])).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    });
});
