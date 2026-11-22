// #28: the edge toolbar, the toolbar of several nodes, focusable handles and resize handles
// (keyboard connection and resize through the adapter), and the simplebezier edge (React's
// tests/toolbars.test.tsx).
import { connection } from "@fragiola/flow/connection";
import { keyboard } from "@fragiola/flow/keyboard";
import { resize } from "@fragiola/flow/resize";
import { selection } from "@fragiola/flow/selection";
import { beforeEach, describe, expect, it } from "vitest";
import { h, shallowRef } from "vue";
import {
    type AnyTypes,
    createFlowRef,
    Flow,
    type FlowEdge,
    type FlowFeatures,
    type FlowNode,
} from "../src/index";
import { NodeResizer } from "../src/resize/index";
import { installLayout, key, part, render, settle, task } from "./flow";

beforeEach(() => {
    installLayout();
});

/** Nodes `a` (0, 0) and `b` (0, 200), an edge `ab` with a toolbar, and a toolbar over `nodeIds`. */
function toolbarFlow(
    flow: ReturnType<typeof createFlowRef<AnyTypes, FlowFeatures>>,
    options: {
        root?: Record<string, unknown>;
        edgeToolbar?: () => Record<string, unknown>;
        nodeIds?: readonly string[];
    } = {},
) {
    return () =>
        h(
            Flow.Root,
            {
                flowRef: flow,
                features: [selection()],
                defaultNodes: [task("a", 0, 0), task("b", 0, 200)],
                defaultEdges: [{ id: "ab", source: "a", target: "b" }],
                ...options.root,
            },
            () => [
                h(Flow.Viewport, null, () => [
                    h(Flow.Edges, null, {
                        default: ({ edge }: { edge: FlowEdge }) => [
                            h(Flow.Edge, { edge }, () => [
                                h(Flow.EdgePath),
                                h(
                                    Flow.EdgeToolbar,
                                    {
                                        "data-testid": "edge-toolbar",
                                        ...options.edgeToolbar?.(),
                                    },
                                    () => [
                                        h("button", { type: "button" }, "x"),
                                    ],
                                ),
                            ]),
                        ],
                    }),
                    h(Flow.Nodes, null, {
                        default: ({ node }: { node: FlowNode }) => [
                            h(Flow.Node, { node }, () => [
                                h(Flow.Handle, { type: "target", side: "top" }),
                                h(Flow.Handle, {
                                    type: "source",
                                    side: "bottom",
                                }),
                            ]),
                        ],
                    }),
                ]),
                options.nodeIds
                    ? h(Flow.NodeToolbar, {
                          "data-testid": "nodes-toolbar",
                          nodeIds: options.nodeIds,
                      })
                    : null,
            ],
        );
}

const byTestId = (container: HTMLElement, id: string) =>
    container.querySelector<HTMLElement>(`[data-testid="${id}"]`);

describe("Flow.EdgeToolbar", () => {
    it("stands at its edge's label point outside the zoom while the edge is selected, and follows the viewport", async () => {
        const flow = createFlowRef<AnyTypes, FlowFeatures>();
        const { container } = await render(
            toolbarFlow(flow, {
                root: { defaultViewport: { x: 0, y: 0, zoom: 2 } },
            }),
        );
        await settle();
        expect(byTestId(container, "edge-toolbar")).toBeNull();
        flow.value?.model.run("selection.set", { edgeIds: ["ab"] });
        await settle();
        const toolbar = byTestId(container, "edge-toolbar") as HTMLElement;
        expect(toolbar.parentElement).toBe(part(container, "root"));
        expect(toolbar).toHaveAttribute("data-flow-part", "toolbar");
        expect(toolbar).toHaveAttribute("data-flow-id", "ab");
        // HTML, though written inside the edges' SVG
        expect(toolbar).toBeInstanceOf(HTMLDivElement);
        expect(toolbar.querySelector("button")).toBeInstanceOf(
            HTMLButtonElement,
        );
        // the label point of a's bottom (50, 40) to b's top (50, 200), at zoom 2
        expect(toolbar.style.position).toBe("absolute");
        expect(toolbar.style.transform).toBe(
            "translate(100px, 240px) translate(-50%, -50%)",
        );
        flow.value?.engine.run("set-viewport", { x: 10, y: 20, zoom: 1 });
        await settle();
        expect(byTestId(container, "edge-toolbar")?.style.transform).toBe(
            "translate(60px, 140px) translate(-50%, -50%)",
        );
        flow.value?.model.run("selection.clear", {});
        await settle();
        expect(byTestId(container, "edge-toolbar")).toBeNull();
    });

    it("stands at an end with an offset, and open decides whether it is shown", async () => {
        const flow = createFlowRef<AnyTypes, FlowFeatures>();
        const props = shallowRef<Record<string, unknown>>({
            open: true,
            position: "source",
            offset: { x: 5, y: -8 },
        });
        const { container } = await render(
            toolbarFlow(flow, { edgeToolbar: () => props.value }),
        );
        await settle();
        // a's bottom centre (50, 40), moved by the offset
        expect(byTestId(container, "edge-toolbar")?.style.transform).toBe(
            "translate(55px, 32px) translate(-50%, -50%)",
        );
        props.value = { open: true, position: "target" };
        await settle();
        expect(byTestId(container, "edge-toolbar")?.style.transform).toBe(
            "translate(50px, 200px) translate(-50%, -50%)",
        );
        flow.value?.model.run("selection.set", { edgeIds: ["ab"] });
        props.value = { open: false };
        await settle();
        expect(byTestId(container, "edge-toolbar")).toBeNull();
    });
});

describe("Flow.NodeToolbar with nodeIds", () => {
    it("stands beside the nodes' bounds, shown while every one of them is selected", async () => {
        const flow = createFlowRef<AnyTypes, FlowFeatures>();
        const { container } = await render(
            toolbarFlow(flow, { nodeIds: ["a", "b"] }),
        );
        await settle();
        expect(byTestId(container, "nodes-toolbar")).toBeNull();
        flow.value?.model.run("selection.set", { nodeIds: ["a"] });
        await settle();
        expect(byTestId(container, "nodes-toolbar")).toBeNull();
        flow.value?.model.run("selection.set", { nodeIds: ["a", "b"] });
        await settle();
        const toolbar = byTestId(container, "nodes-toolbar") as HTMLElement;
        expect(toolbar.parentElement).toBe(part(container, "root"));
        expect(toolbar).toHaveAttribute("data-flow-part", "toolbar");
        expect(toolbar).not.toHaveAttribute("data-flow-id");
        // the bounds (0, 0, 100, 240): their top centre, 10 pixels above
        expect(toolbar.style.transform).toBe(
            "translate(50px, -10px) translate(-50%, -100%)",
        );
    });
});

/** A flow with handles and resize handles, with the given features. */
function keyboardFlow(root: Record<string, unknown>) {
    return () =>
        h(
            Flow.Root,
            { defaultNodes: [task("a", 0, 0), task("b", 0, 200)], ...root },
            () => [
                h(Flow.Viewport, null, () => [
                    h(Flow.Edges, null, {
                        default: ({ edge }: { edge: FlowEdge }) => [
                            h(Flow.Edge, { edge }),
                        ],
                    }),
                    h(Flow.Nodes, null, {
                        default: ({ node }: { node: FlowNode }) => [
                            h(Flow.Node, { node }, () => [
                                h(Flow.Handle, { type: "target", side: "top" }),
                                h(Flow.Handle, {
                                    type: "source",
                                    side: "bottom",
                                }),
                                h(NodeResizer),
                            ]),
                        ],
                    }),
                    h(Flow.ConnectionLine),
                ]),
            ],
        );
}

describe("focusable handles and resize handles", () => {
    it("take focus only with keyboard() and their feature", async () => {
        const cases = [
            {
                features: [connection(), resize()],
                handle: false,
                resizer: false,
            },
            { features: [keyboard()], handle: false, resizer: false },
            {
                features: [keyboard(), connection()],
                handle: true,
                resizer: false,
            },
            { features: [resize(), keyboard()], handle: false, resizer: true },
        ];
        for (const c of cases) {
            const { container, wrapper } = await render(
                keyboardFlow({ features: c.features }),
            );
            const handle = part(container, "handle");
            const resizeHandle = part(container, "resize-handle");
            expect(handle.getAttribute("tabindex")).toBe(c.handle ? "0" : null);
            expect(resizeHandle.getAttribute("tabindex")).toBe(
                c.resizer ? "0" : null,
            );
            wrapper.unmount();
        }
    });

    it("connect from the keyboard: Enter starts, Tab marks the target, Enter adds the edge", async () => {
        const flow = createFlowRef<AnyTypes, FlowFeatures>();
        const { container } = await render(
            keyboardFlow({
                flowRef: flow,
                features: [keyboard(), connection()],
            }),
        );
        const source = container.querySelector(
            '[data-flow-id="a"] [data-handle-type="source"]',
        ) as HTMLElement;
        const target = container.querySelector(
            '[data-flow-id="b"] [data-handle-type="target"]',
        ) as HTMLElement;
        source.focus();
        await key(source, "Enter");
        expect(source).toHaveAttribute("data-connecting");
        await key(source, "Tab");
        expect(target).toHaveAttribute("data-valid");
        await key(source, "Enter");
        expect(flow.value?.model.get("all-edges")).toMatchObject([
            { source: "a", target: "b" },
        ]);
        expect(source).not.toHaveAttribute("data-connecting");
    });

    it("resize from the keyboard: an arrow on a focused resize handle moves its side", async () => {
        const { container } = await render(
            keyboardFlow({ features: [keyboard(), resize()] }),
        );
        const right = part(container, "node", "a").querySelector(
            '[data-position="right"]',
        ) as HTMLElement;
        right.focus();
        await key(right, "ArrowRight");
        expect(part(container, "node", "a").style.width).not.toBe("100px");
    });
});

describe("the simplebezier edge", () => {
    it("is drawn by the default edge path", async () => {
        const flow = createFlowRef<AnyTypes, FlowFeatures>();
        const { container } = await render(
            toolbarFlow(flow, {
                root: {
                    defaultEdges: [
                        {
                            id: "ab",
                            source: "a",
                            target: "b",
                            type: "simplebezier",
                        },
                    ],
                },
            }),
        );
        const d = part(container, "edge-path", "ab").getAttribute("d");
        expect(d).toBe(
            flow.value?.engine.get("edge-path-by", { edgeId: "ab" })?.path,
        );
        expect(d).toMatch(/^M ?50[ ,]40/);
    });
});
