// The primitive contract (guidelines components/primitives.md), in Vue, for every primitive: a
// part attribute on every element, `as` (a tag or a component) and the `render` slot (never
// `asChild`), template refs that reach the primitive's element, the consumer's listeners after the
// internal ones, `class` and `style` merged (the state through the `render` slot and the default
// slot), structural style that wins, and no text or name of its own.
import { connection } from "@fragiola/flow/connection";
import { minimap } from "@fragiola/flow/minimap";
import { resize } from "@fragiola/flow/resize";
import { selection } from "@fragiola/flow/selection";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    defineComponent,
    h,
    shallowRef,
    type VNode,
    type VNodeChild,
} from "vue";
import {
    createFlowRef,
    Flow,
    type FlowEdge,
    type FlowNode,
    type NodeState,
} from "../src/index";
import { MiniMap, MiniMapMask, MiniMapNode } from "../src/minimap/index";
import { NodeResizer, ResizeHandle } from "../src/resize/index";
import {
    click,
    installLayout,
    pair,
    part,
    pointer,
    render,
    settle,
} from "./flow";

beforeEach(() => {
    installLayout();
});

const FEATURES = [selection(), connection(), resize(), minimap()] as const;

type Attrs = Record<string, unknown>;
type Slots = Record<string, unknown>;

/** What the primitive under test is given: attributes and props, and slots. */
interface Given {
    attrs?: Attrs;
    slots?: Slots;
}

/** One primitive's case. */
interface Case {
    /** the part the primitive's element carries */
    part: string;
    /** its default element */
    tag: string;
    /** what brings the primitive on screen (a gesture under way) */
    setup?: (container: HTMLElement) => Promise<void>;
    /** a structural style key it sets, which a consumer's style does not override */
    structural?: [string, string, string];
    /** its element is rendered elsewhere than its component (a layer, the root) */
    elsewhere?: boolean;
    /** the place in the flow given the props, when not its part's (the edge's toolbar) */
    slot?: string;
}

/** The flow every case renders, with the primitive `slot` given `given`. */
function flowWith(slot: string, given: Given): VNodeChild {
    const attrs = (name: string) => (name === slot ? (given.attrs ?? {}) : {});
    const slots = (name: string, own: Slots = {}) =>
        name === slot ? { ...own, ...given.slots } : own;
    const { nodes, edges } = pair();
    return h(
        Flow.Root,
        {
            ...attrs("root"),
            features: FEATURES,
            defaultNodes: nodes.map((node) =>
                node.id === "a" ? { ...node, selected: true } : node,
            ),
            defaultEdges: edges,
        },
        slots("root", {
            default: () => [
                h(Flow.Background, attrs("background"), slots("background")),
                h(
                    Flow.Viewport,
                    attrs("viewport"),
                    slots("viewport", {
                        default: () => [
                            h(
                                Flow.Edges,
                                attrs("edges"),
                                slots("edges", {
                                    default: ({ edge }: { edge: FlowEdge }) => [
                                        h(
                                            Flow.Edge,
                                            { ...attrs("edge"), edge },
                                            slots("edge", {
                                                default: () => [
                                                    h(
                                                        Flow.EdgePath,
                                                        attrs("edge-path"),
                                                        slots("edge-path"),
                                                    ),
                                                    h(
                                                        Flow.EdgeLabel,
                                                        attrs("edge-label"),
                                                        slots("edge-label"),
                                                    ),
                                                    h(
                                                        Flow.ReconnectAnchor,
                                                        {
                                                            end: "target",
                                                            ...attrs(
                                                                "reconnect-anchor",
                                                            ),
                                                        },
                                                        slots(
                                                            "reconnect-anchor",
                                                        ),
                                                    ),
                                                    h(
                                                        Flow.EdgeToolbar,
                                                        {
                                                            open: true,
                                                            ...attrs(
                                                                "edge-toolbar",
                                                            ),
                                                        },
                                                        slots("edge-toolbar"),
                                                    ),
                                                ],
                                            }),
                                        ),
                                    ],
                                }),
                            ),
                            h(
                                Flow.Nodes,
                                attrs("nodes"),
                                slots("nodes", {
                                    default: ({ node }: { node: FlowNode }) => [
                                        h(
                                            Flow.Node,
                                            { ...attrs("node"), node },
                                            slots("node", {
                                                default: () => [
                                                    h(
                                                        Flow.Handle,
                                                        {
                                                            type: "target",
                                                            side: "top",
                                                            ...attrs("handle"),
                                                        },
                                                        slots("handle"),
                                                    ),
                                                    h(Flow.Handle, {
                                                        type: "source",
                                                        side: "bottom",
                                                    }),
                                                    ...(node.id === "a"
                                                        ? [
                                                              h(
                                                                  NodeResizer,
                                                                  attrs(
                                                                      "resizer",
                                                                  ),
                                                                  slots(
                                                                      "resizer",
                                                                      {
                                                                          default:
                                                                              () => [
                                                                                  h(
                                                                                      ResizeHandle,
                                                                                      {
                                                                                          position:
                                                                                              "bottom-right",
                                                                                          ...attrs(
                                                                                              "resize-handle",
                                                                                          ),
                                                                                      },
                                                                                      slots(
                                                                                          "resize-handle",
                                                                                      ),
                                                                                  ),
                                                                              ],
                                                                      },
                                                                  ),
                                                              ),
                                                              h(
                                                                  Flow.NodeToolbar,
                                                                  attrs(
                                                                      "toolbar",
                                                                  ),
                                                                  slots(
                                                                      "toolbar",
                                                                  ),
                                                              ),
                                                          ]
                                                        : []),
                                                ],
                                            }),
                                        ),
                                    ],
                                }),
                            ),
                            h(
                                Flow.ConnectionLine,
                                attrs("connection-line"),
                                slots("connection-line"),
                            ),
                        ],
                    }),
                ),
                h(
                    Flow.SelectionBox,
                    attrs("selection-box"),
                    slots("selection-box"),
                ),
                h(
                    Flow.Controls,
                    attrs("controls"),
                    slots("controls", {
                        default: () => [
                            h(Flow.ZoomIn, attrs("zoom-in"), slots("zoom-in")),
                            h(
                                Flow.ZoomOut,
                                attrs("zoom-out"),
                                slots("zoom-out"),
                            ),
                            h(
                                Flow.FitView,
                                attrs("fit-view"),
                                slots("fit-view"),
                            ),
                            h(
                                Flow.ToggleInteractive,
                                attrs("toggle-interactive"),
                                slots("toggle-interactive"),
                            ),
                        ],
                    }),
                ),
                h(
                    MiniMap,
                    attrs("minimap"),
                    slots("minimap", {
                        default: () => [
                            h(
                                MiniMapNode,
                                { nodeId: "a", ...attrs("minimap-node") },
                                slots("minimap-node"),
                            ),
                            h(
                                MiniMapMask,
                                attrs("minimap-mask"),
                                slots("minimap-mask"),
                            ),
                        ],
                    }),
                ),
            ],
        }),
    );
}

/** A connection from `a`'s source handle, under way. */
async function startConnection(container: HTMLElement) {
    const handle = container.querySelector(
        '[data-flow-id="a"] [data-handle-type="source"]',
    ) as Element;
    await pointer(handle, "pointerdown", { clientX: 50, clientY: 40 });
    await pointer(part(container, "root"), "pointermove", {
        clientX: 300,
        clientY: 300,
    });
}

/** A box selection, under way. */
async function startBox(container: HTMLElement) {
    await pointer(part(container, "viewport"), "pointerdown", {
        clientX: 400,
        clientY: 400,
        shiftKey: true,
    });
    await pointer(part(container, "root"), "pointermove", {
        clientX: 500,
        clientY: 500,
        shiftKey: true,
    });
}

const CASES: Case[] = [
    {
        part: "root",
        tag: "div",
        structural: ["position", "static", "relative"],
    },
    {
        part: "viewport",
        tag: "div",
        structural: ["position", "static", "absolute"],
    },
    {
        part: "nodes",
        tag: "div",
        structural: ["position", "static", "absolute"],
    },
    {
        part: "node",
        tag: "div",
        structural: ["position", "static", "absolute"],
    },
    {
        part: "handle",
        tag: "div",
        structural: ["position", "static", "absolute"],
    },
    {
        part: "edges",
        tag: "div",
        structural: ["pointerEvents", "auto", "none"],
    },
    { part: "edge", tag: "g" },
    { part: "edge-path", tag: "path" },
    {
        part: "edge-label",
        tag: "div",
        structural: ["position", "static", "absolute"],
        elsewhere: true,
    },
    { part: "reconnect-anchor", tag: "circle" },
    {
        part: "connection-line",
        tag: "svg",
        setup: startConnection,
        structural: ["pointerEvents", "auto", "none"],
    },
    {
        part: "selection-box",
        tag: "div",
        setup: startBox,
        structural: ["position", "static", "absolute"],
    },
    {
        part: "background",
        tag: "svg",
        structural: ["position", "static", "absolute"],
    },
    { part: "controls", tag: "div" },
    { part: "zoom-in", tag: "button" },
    { part: "zoom-out", tag: "button" },
    { part: "fit-view", tag: "button" },
    { part: "toggle-interactive", tag: "button" },
    {
        part: "toolbar",
        tag: "div",
        structural: ["position", "static", "absolute"],
        elsewhere: true,
    },
    {
        // the edge's toolbar: the same part
        part: "toolbar",
        slot: "edge-toolbar",
        tag: "div",
        structural: ["position", "static", "absolute"],
        elsewhere: true,
    },
    { part: "minimap", tag: "svg" },
    { part: "minimap-node", tag: "rect" },
    { part: "minimap-mask", tag: "path" },
    {
        part: "resizer",
        tag: "div",
        structural: ["position", "static", "absolute"],
    },
    {
        part: "resize-handle",
        tag: "div",
        structural: ["position", "static", "absolute"],
    },
];

/** The primitive's element: the one carrying the case's marker. */
function find(container: HTMLElement, marker = "case"): HTMLElement {
    const element = container.querySelector<HTMLElement>(
        `[data-testid="${marker}"]`,
    );
    if (!element) throw new Error(`no [data-testid="${marker}"]`);
    return element;
}

async function mount(c: Case, given: Given) {
    const view = await render(() => flowWith(c.slot ?? c.part, given));
    await c.setup?.(view.container);
    return view;
}

describe.each(CASES)("the $part primitive", (c) => {
    it("renders its element with its part attribute, and a part attribute on every element it renders", async () => {
        const { container } = await mount(c, {
            attrs: { "data-testid": "case" },
        });
        const element = find(container);
        expect(element.tagName.toLowerCase()).toBe(c.tag);
        expect(element.getAttribute("data-flow-part")).toBe(c.part);
        for (const inner of element.querySelectorAll("*")) {
            expect(inner.hasAttribute("data-flow-part"), inner.outerHTML).toBe(
                true,
            );
        }
    });

    it("renders no text and no name of its own", async () => {
        const { container } = await mount(c, {
            attrs: { "data-testid": "case" },
        });
        const element = find(container);
        expect(element.textContent).toBe("");
        expect(element.hasAttribute("aria-label")).toBe(false);
        expect(element.querySelector("[aria-label]")).toBeNull();
    });

    it("renders another component with `as`, its props merged into it", async () => {
        const As = defineComponent({
            inheritAttrs: false,
            setup(_, { attrs, slots }) {
                return () =>
                    h(
                        c.tag,
                        { ...attrs, "data-own": "yes" },
                        slots.default?.(),
                    );
            },
        });
        const { container } = await mount(c, {
            attrs: { as: As, "data-testid": "case" },
        });
        const element = find(container);
        expect(element.tagName.toLowerCase()).toBe(c.tag);
        expect(element.getAttribute("data-flow-part")).toBe(c.part);
        expect(element).toHaveAttribute("data-own", "yes");
    });

    it("calls its render slot with its props and its state", async () => {
        const renderSlot = vi.fn(
            ({ props }: { props: Attrs; state: unknown }): VNode[] => [
                h(c.tag, { ...props, "data-testid": "case" }),
            ],
        );
        const { container } = await mount(c, {
            slots: { render: renderSlot },
        });
        const element = find(container);
        expect(element.getAttribute("data-flow-part")).toBe(c.part);
        const state = renderSlot.mock.calls.at(-1)?.[0].state;
        expect(typeof state).toBe("object");
        expect(state).not.toBeNull();
    });

    it.runIf(!c.elsewhere)(
        "reaches its element through a template ref, its own ref still bound",
        async () => {
            const ref = shallowRef<{ $el: unknown } | null>(null);
            const { container } = await mount(c, {
                attrs: { ref, "data-testid": "case" },
            });
            // a primitive rendered for several entities (a node) gives the ref the last one
            expect([
                ...container.querySelectorAll('[data-testid="case"]'),
            ]).toContain(ref.value?.$el);
        },
    );

    it("runs the consumer's listeners after its own", async () => {
        const onClick = vi.fn();
        const { container } = await mount(c, {
            attrs: { onClick, "data-testid": "case" },
        });
        await click(find(container));
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("takes class and style, any of Vue's forms", async () => {
        const { container } = await mount(c, {
            attrs: {
                class: ["plain", { on: true }],
                style: "color: red",
                "data-testid": "case",
            },
        });
        const element = find(container);
        expect(element).toHaveClass("plain", "on");
        expect(element.style.color).toBe("red");
    });

    it.runIf(c.structural !== undefined)(
        "keeps its structural style over the consumer's",
        async () => {
            const [key, mine, its] = c.structural ?? ["position", "", ""];
            const { container } = await mount(c, {
                attrs: { style: { [key]: mine }, "data-testid": "case" },
            });
            expect(
                find(container).style[key as keyof CSSStyleDeclaration],
            ).toBe(its);
        },
    );
});

describe("the state", () => {
    it("reaches the default slot and the render slot, and shows as data-* attributes", async () => {
        const seen: NodeState[] = [];
        const { container } = await mount(CASES[3] as Case, {
            slots: {
                default: ({ state }: { state: NodeState }) => {
                    seen.push(state);
                    return [];
                },
            },
        });
        expect(part(container, "node", "a")).toHaveAttribute("data-selected");
        expect(seen.find((state) => state.nodeId === "a")?.selected).toBe(true);
        expect(seen.find((state) => state.nodeId === "b")?.selected).toBe(
            false,
        );
    });

    it('never writes "false" in a data-* attribute', async () => {
        const { container } = await mount(CASES[0] as Case, {});
        const values = [...container.querySelectorAll("*")].flatMap((element) =>
            [...element.attributes]
                .filter(({ name }) => name.startsWith("data-"))
                .map(({ value }) => value),
        );
        expect(values).not.toContain("false");
    });
});

describe("the control buttons", () => {
    it("run their action before the consumer's listener, and are disabled while the engine refuses it", async () => {
        const calls: string[] = [];
        const flow = createFlowRef();
        const { container } = await render(() =>
            h(Flow.Root, { flowRef: flow, maxZoom: 1.2 }, () => [
                h(Flow.Viewport),
                h(Flow.ZoomIn, {
                    "data-testid": "in",
                    onClick: () =>
                        calls.push(
                            `zoom ${flow.value?.engine.get("viewport").zoom}`,
                        ),
                }),
                h(Flow.ToggleInteractive, { "data-testid": "lock" }),
            ]),
        );
        const zoomIn = find(container, "in");
        await click(zoomIn);
        expect(calls).toEqual(["zoom 1.2"]);
        expect(zoomIn).toBeDisabled();
        expect(zoomIn).toHaveAttribute("data-disabled");
        const lock = find(container, "lock");
        await click(lock);
        expect(flow.value?.engine.is("interactive")).toBe(false);
        expect(lock).toHaveAttribute("aria-pressed", "true");
        expect(lock).not.toHaveAttribute("data-interactive");
        await settle();
    });
});
