// Two gaps the Vue and Svelte ports found in their adapters (#50, #53), checked in Angular: an
// edge path's children (`animating-edges`' `<animate>`) and a handle placed by the app instead of
// its side (`easy-connect`'s cover handles).
import { Component, input } from "@angular/core";
import { beforeEach, describe, expect, it } from "vitest";
import { FLOW, type FlowEdge, type FlowNode } from "../src/public-api";
import { installLayout, pair, part, render } from "./flow";

@Component({
    selector: "test-parity-flow",
    imports: [FLOW],
    template: `
        <div flowRoot [defaultNodes]="defaultNodes()" [defaultEdges]="defaultEdges()">
            <div flowViewport>
                <div flowEdges>
                    <svg:g *flowEdgesItem="let edge" [flowEdge]="edge">
                        <svg:path flowEdgePath>
                            <svg:animate attributeName="stroke-dashoffset" from="0" to="-20" dur="1s" repeatCount="indefinite" />
                        </svg:path>
                    </svg:g>
                </div>
                <div flowNodes>
                    <div *flowNodesItem="let node" [flowNode]="node">
                        <div flowHandle type="target" side="top" data-testid="placed"></div>
                        <div
                            flowHandle
                            type="source"
                            side="bottom"
                            data-testid="cover"
                            [style.top]="cover"
                            [style.left]="cover"
                            [style.transform]="cover"
                        ></div>
                    </div>
                </div>
            </div>
        </div>
    `,
})
class ParityFlow {
    readonly defaultNodes = input<readonly FlowNode[]>([]);
    readonly defaultEdges = input<readonly FlowEdge[]>([]);
    /** hands a key back to the app's classes, as React's `undefined` key does */
    readonly cover = "revert-layer";
}

beforeEach(() => {
    installLayout();
});

describe("parity with React's parts", () => {
    it("renders an edge path's children inside its path (React's children)", async () => {
        const { nodes, edges } = pair();
        const { container } = await render(ParityFlow, {
            defaultNodes: nodes,
            defaultEdges: edges,
        });
        const path = part(container, "edge-path", "ab");
        expect(path.tagName.toLowerCase()).toBe("path");
        expect(path.getAttribute("d")).toMatch(/^M/);
        const animate = path.querySelector("animate");
        expect(animate?.getAttribute("attributeName")).toBe(
            "stroke-dashoffset",
        );
        expect(animate?.parentElement).toBe(path);
    });

    it("lets the app's style replace a handle's side placement, which it then never writes", async () => {
        const { container } = await render(ParityFlow, {
            defaultNodes: pair().nodes,
        });
        const node = part(container, "node", "a");
        const placed = node.querySelector<HTMLElement>(
            '[data-testid="placed"]',
        );
        const cover = node.querySelector<HTMLElement>('[data-testid="cover"]');
        expect(placed?.style.top).toBe("0px");
        expect(placed?.style.transform).toBe("translate(-50%, -50%)");
        // React's `{ top: undefined, left: undefined, transform: undefined }`: Angular drops an
        // undefined binding, so the app hands the keys back to its classes with `revert-layer`
        expect(cover?.style.top).toBe("revert-layer");
        expect(cover?.style.left).toBe("revert-layer");
        expect(cover?.style.transform).toBe("revert-layer");
        expect(cover?.style.position).toBe("absolute");
    });
});
