// Type fixtures (checked by `pnpm typecheck`, never run): the typed surface of the primitives and
// composables, by the app's registry and features.
import { connection } from "@fragiola/flow/connection";
import { h } from "vue";
import {
    createFlowRef,
    type FlowNode,
    type NodeState,
    typedFlow,
    useFlow,
    useNode,
    useViewport,
} from "../../src/index";

interface Types {
    readonly nodes: { task: { title: string }; note: { text: string } };
    readonly edges: { dependency: { weight: number } };
}

const features = [connection()] as const;
const Flow = typedFlow<Types, typeof features>();

export function typed() {
    const flow = createFlowRef<Types, typeof features>();
    return h(
        Flow.Root,
        {
            flowRef: flow,
            features,
            defaultNodes: [
                {
                    id: "a",
                    type: "task",
                    position: { x: 0, y: 0 },
                    data: { title: "A" },
                },
            ],
            nodes: [
                {
                    id: "b",
                    type: "task",
                    position: { x: 0, y: 0 },
                    // @ts-expect-error: a task's data is its registry's
                    data: { text: "" },
                },
            ],
            "onUpdate:nodes": (nodes: readonly FlowNode<Types>[]) =>
                nodes[0]?.type,
            // one event per engine event (#33), with its event (`@node-click` in a template; Vue
            // types an `h()` listener of a kebab-case event as `on` + its capitalized name)
            "onNode-click": (event) => event.nodeId,
            "onMove-start": (event) => event.viewport.zoom,
            onInit: (event) => event.type === "ready",
            // @ts-expect-error: a pane click has no node
            "onPane-click": (event) => event.nodeId,
        },
        () =>
            h(Flow.Viewport, null, () => [
                h(Flow.Nodes, null, {
                    default: ({ node }: { node: FlowNode<Types> }) => [
                        h(
                            Flow.Node,
                            { node },
                            {
                                default: ({
                                    state,
                                }: {
                                    state: NodeState<Types>;
                                }) => [
                                    state.node.type === "task"
                                        ? state.node.data.title
                                        : state.node.data.text,
                                ],
                            },
                        ),
                    ],
                }),
            ]),
    );
}

export function composables() {
    const { model, engine } = useFlow<Types, typeof features>();
    engine.get("connection");
    model.run("node.move", { nodeId: "a", position: { x: 1, y: 2 } });
    const bare = useFlow<Types>();
    // @ts-expect-error: the connection key is connection()'s
    bare.engine.get("connection");
    // @ts-expect-error: no such command
    bare.model.run("node.fly", {});
    const zoom: number = useViewport().value.zoom;
    const node = model.get("node-by", { id: "a" });
    if (node) {
        const { state } = useNode<Types>(node);
        const title: string | undefined =
            state.value.node.type === "task"
                ? state.value.node.data.title
                : undefined;
        return [zoom, title];
    }
    return [zoom];
}
