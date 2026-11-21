import { drag as dragFeature } from "@fragiola/flow/drag";
import { selection } from "@fragiola/flow/selection";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, shallowRef } from "vue";
import {
    Flow,
    type FlowFeatures,
    type FlowNode,
    useSelection,
} from "../src/index";
import { MiniMap, minimap } from "../src/minimap/index";
import { NodeResizer, resize } from "../src/resize/index";
import {
    drag,
    installLayout,
    pair,
    part,
    pointer,
    render,
    settle,
    TestFlow,
    task,
} from "./flow";

beforeEach(() => {
    installLayout();
});

describe("features", () => {
    it("are fixed when the root creates its model: a later change warns and is ignored", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const features = shallowRef<FlowFeatures>([selection()]);
        const { container } = await render(() =>
            h(TestFlow, {
                features: features.value,
                defaultNodes: [task("a")],
            }),
        );
        features.value = [selection(), dragFeature()];
        await settle();
        expect(warn).toHaveBeenCalledWith(
            expect.stringMatching(/features prop changed/),
        );
        // no drag(): a press selects, a move pans
        await drag(part(container, "node", "a"), part(container, "root"), [
            { clientX: 10, clientY: 10 },
            { clientX: 60, clientY: 10 },
        ]);
        expect(part(container, "node", "a").style.transform).toBe(
            "translate(0px, 0px)",
        );
    });

    it("selection(): a box selects the nodes it covers, a press on an edge selects it", async () => {
        const seen: string[][] = [];
        const Selected = defineComponent({
            setup() {
                const selected = useSelection();
                return () => {
                    seen.push(selected.value.nodes.map((node) => node.id));
                    return null;
                };
            },
        });
        const { container } = await render(() =>
            h(
                TestFlow,
                {
                    features: [selection()],
                    defaultNodes: pair().nodes,
                    defaultEdges: pair().edges,
                },
                () => [h(Selected)],
            ),
        );
        const root = part(container, "root");
        await pointer(part(container, "viewport"), "pointerdown", {
            clientX: -10,
            clientY: -10,
            shiftKey: true,
        });
        await pointer(root, "pointermove", {
            clientX: 120,
            clientY: 60,
            shiftKey: true,
        });
        expect(part(container, "selection-box").style.width).toBe("130px");
        expect(root).toHaveAttribute("data-selecting");
        await pointer(root, "pointerup", {
            clientX: 120,
            clientY: 60,
            shiftKey: true,
        });
        expect(part(container, "node", "a")).toHaveAttribute("data-selected");
        expect(seen.at(-1)).toEqual(["a"]);
        const path = part(container, "edge-path", "ab");
        await pointer(path, "pointerdown", { clientX: 50, clientY: 120 });
        await pointer(root, "pointerup", { clientX: 50, clientY: 120 });
        expect(part(container, "edge", "ab")).toHaveAttribute("data-selected");
    });

    it("resize(): a resize handle resizes its node within the resizer's limits", async () => {
        const { container } = await render(() =>
            h(
                Flow.Root,
                { features: [resize()], defaultNodes: [task("a")] },
                () => [
                    h(Flow.Viewport, null, () => [
                        h(Flow.Nodes, null, {
                            default: ({ node }: { node: FlowNode }) => [
                                h(Flow.Node, { node }, () => [
                                    h(NodeResizer, { maxWidth: 150 }),
                                ]),
                            ],
                        }),
                    ]),
                ],
            ),
        );
        const handles = container.querySelectorAll(
            '[data-flow-part="resize-handle"]',
        );
        expect(handles).toHaveLength(8);
        const corner = container.querySelector(
            '[data-position="bottom-right"]',
        ) as HTMLElement;
        // a corner is above the full-length sides it joins: a press on it is the corner's
        expect(corner.style.zIndex).toBe("1");
        expect(
            (container.querySelector('[data-position="right"]') as HTMLElement)
                .style.zIndex,
        ).toBe("");
        await drag(corner, part(container, "root"), [
            { clientX: 100, clientY: 40 },
            { clientX: 300, clientY: 80 },
        ]);
        const node = part(container, "node", "a");
        expect(node.style.width).toBe("150px");
        expect(node.style.height).toBe("80px");
    });

    it("minimap(): the map draws every node and the mask, and a press on it pans the flow", async () => {
        const { container } = await render(() =>
            h(
                Flow.Root,
                {
                    features: [minimap()],
                    defaultNodes: [task("a"), task("b", 400, 300)],
                },
                () => [
                    h(Flow.Viewport, null, () => [
                        h(Flow.Nodes, null, {
                            default: ({ node }: { node: FlowNode }) => [
                                h(Flow.Node, { node }),
                            ],
                        }),
                    ]),
                    h(MiniMap, { width: 200, height: 150 }),
                ],
            ),
        );
        const map = part(container, "minimap");
        expect(map.getAttribute("viewBox")).toMatch(
            /^-?[\d.]+ -?[\d.]+ [\d.]+ [\d.]+$/,
        );
        expect(
            container.querySelectorAll('[data-flow-part="minimap-node"]'),
        ).toHaveLength(2);
        expect(part(container, "minimap-mask").getAttribute("fill-rule")).toBe(
            "evenodd",
        );
        const before = part(container, "viewport").style.transform;
        await pointer(map, "pointerdown", { clientX: 190, clientY: 140 });
        await pointer(part(container, "root"), "pointerup", {
            clientX: 190,
            clientY: 140,
        });
        expect(part(container, "viewport").style.transform).not.toBe(before);
    });
});
