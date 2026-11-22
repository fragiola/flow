// Type fixtures (checked by `pnpm typecheck`, never run): the typed surface of the primitives and
// hooks, by the app's registry and features.
import { connection } from "@fragiola/flow/connection";
import {
    createFlowRef,
    Flow,
    type FlowNode,
    type RenderedProps,
    useFlow,
    useFlowStore,
    useInternalNode,
    useKeyPress,
    useNodeConnections,
    useNodeId,
    useNodesData,
    useOnViewportChange,
} from "../../src/index";

interface Types {
    readonly nodes: { task: { title: string }; note: { text: string } };
    readonly edges: { dependency: { weight: number } };
}

const features = [connection()] as const;

export function Typed() {
    const flow = createFlowRef<Types, typeof features>();
    return (
        <Flow.Root<Types, typeof features>
            flowRef={flow}
            features={features}
            defaultNodes={[
                {
                    id: "a",
                    type: "task",
                    position: { x: 0, y: 0 },
                    data: { title: "A" },
                },
            ]}
            nodes={[
                {
                    id: "b",
                    type: "task",
                    position: { x: 0, y: 0 },
                    // @ts-expect-error: a task's data is its registry's
                    data: { text: "" },
                },
            ]}
        >
            <Flow.Viewport>
                <Flow.Nodes<Types>>
                    {(node: FlowNode<Types>) => (
                        <Flow.Node<Types>
                            node={node}
                            className={(state) =>
                                state.node.type === "task"
                                    ? state.node.data.title
                                    : state.node.data.text
                            }
                        />
                    )}
                </Flow.Nodes>
                <Flow.Edges<Types>>
                    {(edge) => (
                        <Flow.Edge<Types>
                            edge={edge}
                            render={(
                                props: RenderedProps<SVGGElement>,
                                state,
                            ) => <g {...props} data-weight={state.edge.type} />}
                        />
                    )}
                </Flow.Edges>
            </Flow.Viewport>
        </Flow.Root>
    );
}

export function Hooks() {
    const { model, engine } = useFlow<Types, typeof features>();
    engine.get("connection");
    model.run("node.move", { nodeId: "a", position: { x: 1, y: 2 } });
    const bare = useFlow<Types>();
    // @ts-expect-error: the connection key is connection()'s
    bare.engine.get("connection");
    // @ts-expect-error: no such command
    bare.model.run("node.fly", {});
    return null;
}

export function SelectingHooks() {
    const count: number = useFlowStore<number, Types, typeof features>(
        ({ model, engine }) =>
            model.get("all-nodes").length + engine.get("viewport").zoom,
    );
    const one = useNodesData<Types>("a");
    if (one?.type === "task") {
        const title: string = one.data.title;
        void title;
    }
    const many = useNodesData<Types>(["a", "b"]);
    const first: string | undefined = many[0]?.id;
    const connections = useNodeConnections({ handleId: "in", type: "target" });
    const edgeId: string | undefined = connections[0]?.edgeId;
    // @ts-expect-error a connection's type is source or target
    useNodeConnections({ type: "in" });
    const internal = useInternalNode<Types>("a");
    const width: number | undefined = internal?.rect.width;
    const pressed: boolean = useKeyPress(["Meta+s", "Control+s"], {
        target: null,
    });
    const id: string | null = useNodeId();
    useOnViewportChange({
        onEnd: (viewport, gesture: boolean) => void [viewport.zoom, gesture],
    });
    return <>{[count, first, edgeId, width, pressed, id].join()}</>;
}
