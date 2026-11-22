// The render levels (`render-layers`) with an engine: one level keeps the edges' layer as it was,
// several give each level its own `edges-layer` (its SVG and its labels) between the nodes, and an
// edge mounted again in another level takes back its focus (`adapter.refocus`).
import type { AnyTypes, FlowFeatures } from "@fragiola/flow";
import { keyboard } from "@fragiola/flow/keyboard";
import { selection } from "@fragiola/flow/selection";
import { beforeEach, describe, expect, it } from "vitest";
import { h } from "vue";
import { createFlowRef } from "../src/index";
import {
    installLayout,
    pair,
    part,
    render,
    settle,
    TestFlow,
    task,
} from "./flow";

beforeEach(() => {
    installLayout();
});

const features = [selection(), keyboard()];

function threeNodes() {
    return {
        defaultNodes: [...pair().nodes, task("c", 200, 200)],
        defaultEdges: [...pair().edges, { id: "ac", source: "a", target: "c" }],
    };
}

const idsIn = (element: Element, name: string) =>
    [...element.querySelectorAll(`[data-flow-part="${name}"]`)].map((child) =>
        child.getAttribute("data-flow-id"),
    );

describe("the render levels", () => {
    it("keeps one level as today's layer: the SVG and the labels in the edges' element", async () => {
        const { container } = await render(() =>
            h(TestFlow, { features, label: true, ...threeNodes() }),
        );
        const edges = part(container, "edges");
        expect(
            container.querySelector('[data-flow-part="edges-layer"]'),
        ).toBeNull();
        expect(
            [...edges.children].map((child) =>
                child.getAttribute("data-flow-part"),
            ),
        ).toEqual(["edges", "edge-label", "edge-label"]);
        expect(part(container, "nodes").style.isolation).toBe("isolate");
    });

    it("gives a selected edge its own level, with its label, and back to one level when cleared", async () => {
        const flow = createFlowRef<AnyTypes, FlowFeatures>();
        const { container } = await render(() =>
            h(TestFlow, {
                features,
                label: true,
                flowRef: flow,
                ...threeNodes(),
            }),
        );
        flow.value?.model.run("selection.set", { edgeIds: ["ac"] });
        await settle();
        const edges = part(container, "edges");
        const layers = [...edges.children] as HTMLElement[];
        expect(
            layers.map((layer) => layer.getAttribute("data-flow-part")),
        ).toEqual(["edges-layer", "edges-layer"]);
        expect(layers.map((layer) => layer.dataset.level)).toEqual(["0", "1"]);
        // each one's SVG first, then its labels
        for (const layer of layers) {
            expect(layer.firstElementChild?.tagName.toLowerCase()).toBe("svg");
            expect(
                layer.firstElementChild?.getAttribute("data-flow-part"),
            ).toBe("edges");
            expect(layer.style.position).toBe("absolute");
            expect(layer.style.pointerEvents).toBe("none");
            expect(Number(layer.style.zIndex)).toBeLessThan(0);
        }
        const [lower, upper] = layers as [HTMLElement, HTMLElement];
        expect(idsIn(lower, "edge")).toEqual(["ab"]);
        expect(idsIn(lower, "edge-label")).toEqual(["ab"]);
        expect(idsIn(upper, "edge")).toEqual(["ac"]);
        expect(idsIn(upper, "edge-label")).toEqual(["ac"]);
        expect(part(container, "nodes").style.isolation).toBe("");
        const nodeZ = Number(part(container, "node", "a").style.zIndex);
        expect(Number(lower.style.zIndex)).toBeLessThan(nodeZ);
        expect(Number(upper.style.zIndex)).toBeGreaterThan(nodeZ);

        flow.value?.model.run("selection.clear", {});
        await settle();
        expect(
            container.querySelector('[data-flow-part="edges-layer"]'),
        ).toBeNull();
        expect(idsIn(part(container, "edges"), "edge-label")).toEqual([
            "ab",
            "ac",
        ]);
        expect(part(container, "nodes").style.isolation).toBe("isolate");
    });

    it("keeps the nodes' elements when the levels change (no node moves to another layer)", async () => {
        const flow = createFlowRef<AnyTypes, FlowFeatures>();
        const { container } = await render(() =>
            h(TestFlow, { features, flowRef: flow, ...threeNodes() }),
        );
        const node = part(container, "node", "a");
        flow.value?.model.run("selection.set", { edgeIds: ["ac"] });
        await settle();
        expect(part(container, "node", "a")).toBe(node);
    });

    it("refocuses an edge that had focus when it moves to another level", async () => {
        const flow = createFlowRef<AnyTypes, FlowFeatures>();
        const { container } = await render(() =>
            h(TestFlow, {
                features,
                edgesFocusable: true,
                flowRef: flow,
                ...threeNodes(),
            }),
        );
        const before = part(container, "edge", "ac");
        expect(before.getAttribute("tabindex")).toBe("0");
        before.focus();
        expect(document.activeElement).toBe(before);
        flow.value?.model.run("selection.set", { edgeIds: ["ac"] });
        await settle();
        const after = part(container, "edge", "ac");
        expect(after).not.toBe(before);
        expect(
            after
                .closest('[data-flow-part="edges-layer"]')
                ?.getAttribute("data-level"),
        ).toBe("1");
        expect(document.activeElement).toBe(after);
    });
});
