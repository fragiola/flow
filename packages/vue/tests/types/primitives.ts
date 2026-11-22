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
    useFlowStore,
    useInternalNode,
    useKeyPress,
    useNode,
    useNodeConnections,
    useNodeId,
    useNodesData,
    useOnViewportChange,
    useViewport,
} from "../../src/index";
import { MiniMap } from "../../src/minimap/index";
import { NodeResizer } from "../../src/resize/index";

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
            // one event per engine event (#33), with its event (`@node-click` in a template)
            onNodeClick: (event) => event.nodeId,
            onMoveStart: (event) => event.viewport.zoom,
            onInit: (event) => event.type === "ready",
            // @ts-expect-error: a pane click has no node
            onPaneClick: (event) => event.nodeId,
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

export function selectingComposables() {
    const count: number = useFlowStore<number, Types, typeof features>(
        ({ model, engine }) =>
            model.get("all-nodes").length + engine.get("viewport").zoom,
    ).value;
    const one = useNodesData<Types>("a").value;
    if (one?.type === "task") {
        const title: string = one.data.title;
        void title;
    }
    const many = useNodesData<Types>(() => ["a", "b"]).value;
    const first: string | undefined = many[0]?.id;
    const connections = useNodeConnections({
        handleId: "in",
        type: "target",
    }).value;
    const edgeId: string | undefined = connections[0]?.edgeId;
    // @ts-expect-error a connection's type is source or target
    useNodeConnections({ type: "in" });
    const internal = useInternalNode<Types>("a").value;
    const width: number | undefined = internal?.rect.width;
    const pressed: boolean = useKeyPress(["Meta+s", "Control+s"], {
        target: null,
    }).value;
    const id: string | null = useNodeId().value;
    useOnViewportChange({
        onEnd: (viewport, gesture: boolean) => void [viewport.zoom, gesture],
    });
    return [count, first, edgeId, width, pressed, id].join();
}

export function partProps() {
    return [
        h(MiniMap, {
            inversePan: true,
            zoomStep: 20,
            onClick: (event: MouseEvent, point) => void [event.button, point.x],
        }),
        h(NodeResizer, { direction: "horizontal" }),
        // @ts-expect-error a resizer's direction is horizontal or vertical
        h(NodeResizer, { direction: "diagonal" }),
        h(Flow.FitView, {
            nodeIds: ["a"],
            padding: { top: "10px" },
            includeHidden: true,
            minZoom: 0.5,
            maxZoom: "2",
        }),
        h(Flow.EdgeToolbar, {
            point: { x: 0, y: 0 },
            alignX: "start",
            alignY: "end",
        }),
        h(Flow.NodesSelection, { as: "section" }),
    ];
}
