import { drag as dragFeature } from "@fragiola/flow/drag";
import { keyboard } from "@fragiola/flow/keyboard";
import { selection } from "@fragiola/flow/selection";
import { subflows } from "@fragiola/flow/subflows";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    defineComponent,
    h,
    nextTick,
    onMounted,
    type PropType,
    shallowRef,
} from "vue";
import {
    type AnyTypes,
    createFlowRef,
    Flow,
    type FlowEdge,
    type FlowNode,
    useFlow,
    useNode,
} from "../src/index";
import {
    drag,
    installLayout,
    key,
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

describe("nodes", () => {
    it("keep their element when they move: no remount, only the moved node re-renders", async () => {
        const renders = vi.fn();
        const mounts = vi.fn();
        const Content = defineComponent({
            props: { id: { type: String, required: true } },
            setup(props) {
                onMounted(() => mounts(props.id));
                return () => {
                    renders(props.id);
                    return h("span", { "data-flow-part": "label" });
                };
            },
        });
        const features = [selection(), dragFeature()] as const;
        const { container } = await render(() =>
            h(
                Flow.Root,
                { features, defaultNodes: [task("a"), task("b", 0, 200)] },
                () => [
                    h(Flow.Viewport, null, () => [
                        h(Flow.Nodes, null, {
                            default: ({ node }: { node: FlowNode }) => [
                                h(Flow.Node, { node }, () => [
                                    h(Content, { id: node.id }),
                                ]),
                            ],
                        }),
                    ]),
                ],
            ),
        );
        const before = part(container, "node", "a");
        renders.mockClear();
        mounts.mockClear();
        await drag(before, part(container, "root"), [
            { clientX: 10, clientY: 10 },
            { clientX: 40, clientY: 30 },
            { clientX: 70, clientY: 50 },
        ]);
        const after = part(container, "node", "a");
        expect(after).toBe(before);
        expect(after.style.transform).toBe("translate(60px, 40px)");
        expect(mounts).not.toHaveBeenCalled();
        expect(renders.mock.calls.every(([id]) => id === "a")).toBe(true);
    });

    it("render a new slot again: a render function's closure, a slot reading an outer scope", async () => {
        const mark = shallowRef("off");
        const { nodes, edges } = pair();
        const { container } = await render(() => {
            // read here, outside the slots: each render of the app gives Nodes and Edges new slots
            const current = mark.value;
            return h(
                Flow.Root,
                { defaultNodes: nodes, defaultEdges: edges },
                () => [
                    h(Flow.Viewport, null, () => [
                        h(Flow.Edges, null, {
                            default: ({ edge }: { edge: FlowEdge }) => [
                                h(Flow.Edge, { edge, "data-mark": current }),
                            ],
                        }),
                        h(Flow.Nodes, null, {
                            default: ({ node }: { node: FlowNode }) => [
                                h(Flow.Node, { node, "data-mark": current }),
                            ],
                        }),
                    ]),
                ],
            );
        });
        expect(part(container, "node", "a")).toHaveAttribute(
            "data-mark",
            "off",
        );
        expect(part(container, "edge", "ab")).toHaveAttribute(
            "data-mark",
            "off",
        );
        mark.value = "on";
        await settle();
        expect(part(container, "node", "a")).toHaveAttribute("data-mark", "on");
        expect(part(container, "node", "b")).toHaveAttribute("data-mark", "on");
        expect(part(container, "edge", "ab")).toHaveAttribute(
            "data-mark",
            "on",
        );
    });

    it("show the engine's state: selected on a tap, dragging during a drag", async () => {
        const features = [selection(), dragFeature()] as const;
        const { container } = await render(() =>
            h(TestFlow, { features, defaultNodes: [task("a")] }),
        );
        const node = part(container, "node", "a");
        const root = part(container, "root");
        await pointer(node, "pointerdown", { clientX: 10, clientY: 10 });
        await pointer(root, "pointerup", { clientX: 10, clientY: 10 });
        expect(node).toHaveAttribute("data-selected");
        await pointer(node, "pointerdown", { clientX: 10, clientY: 10 });
        await pointer(root, "pointermove", { clientX: 30, clientY: 10 });
        expect(node).toHaveAttribute("data-dragging");
        expect(root).toHaveAttribute("data-dragging");
        await pointer(root, "pointerup", { clientX: 30, clientY: 10 });
        expect(node).not.toHaveAttribute("data-dragging");
    });

    it("take focus with keyboard(), and move with the arrows", async () => {
        const features = [selection(), keyboard()] as const;
        const { container } = await render(() =>
            h(TestFlow, { features, defaultNodes: [task("a")] }),
        );
        const node = part(container, "node", "a");
        expect(node.tabIndex).toBe(0);
        node.focus();
        await key(node, "ArrowRight");
        expect(node.style.transform).toBe("translate(5px, 0px)");
    });

    it("are not focusable without keyboard()", async () => {
        const { container } = await render(() =>
            h(TestFlow, { defaultNodes: [task("a")] }),
        );
        expect(part(container, "node", "a").hasAttribute("tabindex")).toBe(
            false,
        );
    });

    it("render flat at their absolute place with subflows()", async () => {
        const { container } = await render(() =>
            h(TestFlow, {
                features: [subflows()],
                defaultNodes: [
                    task("group", 100, 100, { width: 300, height: 300 }),
                    task("child", 20, 30, { parentId: "group" }),
                ],
            }),
        );
        const child = part(container, "node", "child");
        expect(child.parentElement).toBe(part(container, "nodes"));
        expect(child.style.transform).toBe("translate(120px, 130px)");
    });

    it("can be rendered by hand with useNode", async () => {
        const MyNode = defineComponent({
            props: {
                node: { type: Object as PropType<FlowNode>, required: true },
            },
            setup(props) {
                const { state, props: own } = useNode(() => props.node);
                return () =>
                    h("article", { ...own.value, "data-x": state.value.x });
            },
        });
        const { container } = await render(() =>
            h(Flow.Root, { defaultNodes: [task("a", 7, 8)] }, () => [
                h(Flow.Viewport, null, () => [
                    h(Flow.Nodes, null, {
                        default: ({ node }: { node: FlowNode }) => [
                            h(MyNode, { node }),
                        ],
                    }),
                ]),
            ]),
        );
        const node = part(container, "node", "a");
        expect(node.tagName.toLowerCase()).toBe("article");
        expect(node).toHaveAttribute("data-x", "7");
        expect(node).toHaveAttribute("data-measured");
    });

    it("show a toolbar outside the zoom while selected", async () => {
        const features = [selection()] as const;
        const flow = createFlowRef<AnyTypes, typeof features>();
        const { container } = await render(() =>
            h(
                Flow.Root,
                {
                    flowRef: flow,
                    features,
                    defaultNodes: [task("a", 100, 100)],
                    defaultViewport: { x: 0, y: 0, zoom: 2 },
                },
                () => [
                    h(Flow.Viewport, null, () => [
                        h(Flow.Nodes, null, {
                            default: ({ node }: { node: FlowNode }) => [
                                h(Flow.Node, { node }, () => [
                                    h(Flow.NodeToolbar, {
                                        "data-testid": "toolbar",
                                    }),
                                ]),
                            ],
                        }),
                    ]),
                ],
            ),
        );
        const toolbar = () =>
            container.querySelector<HTMLElement>('[data-testid="toolbar"]');
        expect(toolbar()).toBeNull();
        flow.value?.model.run("selection.set", { nodeIds: ["a"] });
        await settle();
        expect(toolbar()?.parentElement).toBe(part(container, "root"));
        // the node's top centre at zoom 2: (100 + 50) × 2, 100 × 2, minus the offset
        expect(toolbar()?.style.transform).toBe(
            "translate(300px, 190px) translate(-50%, -100%)",
        );
        flow.value?.model.run("selection.clear", {});
        await settle();
        expect(toolbar()).toBeNull();
    });
});

describe("node registration", () => {
    const newRef = () => createFlowRef();
    const flowWith = (
        flow: ReturnType<typeof newRef>,
        content?: (node: FlowNode) => ReturnType<typeof h>,
    ) =>
        render(() =>
            h(Flow.Root, { flowRef: flow, defaultNodes: [task("a")] }, () => [
                h(Flow.Viewport, null, () => [
                    h(Flow.Nodes, null, {
                        default: ({ node }: { node: FlowNode }) => [
                            h(Flow.Node, { node }, () =>
                                content ? [content(node)] : [],
                            ),
                        ],
                    }),
                ]),
            ]),
        );

    it("is done once the patch is: after the app's nextTick, focus-node finds an added node", async () => {
        const flow = createFlowRef();
        await flowWith(flow);
        flow.value?.model.run("node.add", task("b", 0, 200));
        await nextTick();
        expect(
            flow.value?.engine.run("focus-node", { nodeId: "b" }),
        ).toMatchObject({ ok: true });
    });

    it("is done before a custom node's onMounted, in the node's content or with useNode", async () => {
        const seen: [string, boolean][] = [];
        const Content = defineComponent({
            props: { id: { type: String, required: true } },
            setup(props) {
                const { engine } = useFlow();
                onMounted(() =>
                    seen.push([
                        `content ${props.id}`,
                        engine.check("focus-node", { nodeId: props.id }).ok,
                    ]),
                );
                return () => h("span");
            },
        });
        const Custom = defineComponent({
            props: {
                node: { type: Object as PropType<FlowNode>, required: true },
            },
            setup(props) {
                const { engine } = useFlow();
                const { props: element } = useNode(() => props.node);
                onMounted(() =>
                    seen.push([
                        `custom ${props.node.id}`,
                        engine.check("focus-node", { nodeId: props.node.id })
                            .ok,
                    ]),
                );
                return () => h("div", element.value);
            },
        });
        const flow = createFlowRef();
        await render(() =>
            h(Flow.Root, { flowRef: flow, defaultNodes: [task("a")] }, () => [
                h(Flow.Viewport, null, () => [
                    h(Flow.Nodes, null, {
                        default: ({ node }: { node: FlowNode }) => [
                            node.id === "c"
                                ? h(Custom, { node })
                                : h(Flow.Node, { node }, () => [
                                      h(Content, { id: node.id }),
                                  ]),
                        ],
                    }),
                ]),
            ]),
        );
        seen.length = 0;
        flow.value?.model.run("node.add", task("b", 0, 200));
        flow.value?.model.run("node.add", task("c", 0, 400));
        await nextTick();
        expect(seen.sort()).toEqual([
            ["content b", true],
            ["custom c", true],
        ]);
    });

    it("of one node that throws leaves the others registered, and reports the error to the app", async () => {
        const flow = createFlowRef();
        const { wrapper } = await flowWith(flow);
        const errors: unknown[] = [];
        wrapper.vm.$.appContext.config.errorHandler = (error) =>
            errors.push(error);
        // b's first measurement (on its registration) throws
        const failure = new Error("measure b");
        const width = vi.spyOn(HTMLElement.prototype, "offsetWidth", "get");
        const layout = width.getMockImplementation();
        let thrown = false;
        width.mockImplementation(function (this: HTMLElement) {
            if (!thrown && this.getAttribute("data-flow-id") === "b") {
                thrown = true;
                throw failure;
            }
            return layout?.call(this) ?? 0;
        });
        const focusable = (nodeId: string) =>
            flow.value?.engine.check("focus-node", { nodeId }).ok;
        flow.value?.model.run("node.add", task("b", 0, 200));
        flow.value?.model.run("node.add", task("c", 0, 400));
        await nextTick();
        expect(errors).toEqual([failure]);
        expect(focusable("c")).toBe(true);
        flow.value?.model.run("node.add", task("d", 0, 600));
        await nextTick();
        expect(focusable("d")).toBe(true);
    });
});
