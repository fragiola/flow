// @vitest-environment node
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ServerRendering from "../src/examples/server-rendering/index";

// The site export prerenders no flow (its pages are MDX that `www` renders; the embed is a client
// app), so the server render of a flow is checked here, on the example made for it: rendered in
// node with React's server renderer, its HTML holds every edge, drawn from the nodes' declared
// sizes and handles, and every node at its place, the per-node origin applied.

const html = renderToString(createElement(ServerRendering));

/** The `d` of an edge's path in the HTML. */
function pathOf(edgeId: string): string {
    const edge = html.indexOf(`data-flow-part="edge" data-flow-id="${edgeId}"`);
    expect(edge, edgeId).toBeGreaterThanOrEqual(0);
    const d = /data-flow-part="edge-path"[^>]* d="([^"]+)"/.exec(
        html.slice(edge),
    )?.[1];
    expect(d, edgeId).toMatch(/^M/);
    return d ?? "";
}

/** The numbers of a path, in order. */
const numbers = (d: string) => (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

describe("the server-rendering example on the server", () => {
    it("holds every edge's path, from a declared handle to a declared handle", () => {
        expect(html.match(/<path [^>]*d="M/g)).toHaveLength(4);
        // request's right handle (150, 28) to render's left one (220, 28)
        const request = numbers(pathOf("request-render"));
        expect(request.slice(0, 2)).toEqual([150, 28]);
        expect(request.slice(-2)).toEqual([220, 28]);
        // html's bottom handle (515, 56) to hydrate's top one (515, 120): hydrate's own origin
        const hydrate = numbers(pathOf("html-hydrate"));
        expect(hydrate.slice(0, 2)).toEqual([515, 56]);
        expect(hydrate.slice(-2)).toEqual([515, 120]);
        // to measure's right side, from its initial size (its targetPosition)
        const measure = numbers(pathOf("hydrate-measure"));
        expect(measure.slice(-2)).toEqual([370, 148]);
    });

    it("places every node, hydrate by its own origin (its top centre)", () => {
        expect(html.match(/data-flow-part="node"/g)).toHaveLength(5);
        const place = (id: string) =>
            /transform:translate\(([^)]+)\)/.exec(
                html.slice(
                    html.indexOf(`data-flow-part="node" data-flow-id="${id}"`),
                ),
            )?.[1];
        expect(place("request")).toBe("0px, 0px");
        expect(place("html")).toBe("440px, 0px");
        expect(place("hydrate")).toBe("440px, 120px");
        expect(place("measure")).toBe("220px, 120px");
    });
});
