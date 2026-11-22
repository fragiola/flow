<!--
    Type fixture (checked by `pnpm typecheck`, svelte-check, never run): the typed surface of the
    primitives and runes, by the app's registry and features. A template takes no type argument:
    `typedFlow` types the parts, and a component's generics are inferred from its props.
-->
<script module lang="ts">
    import { connection } from "@fragiola/flow/connection";
    import type { FlowNode, FlowTypes, RootProps } from "../../src/index.js";

    interface Types extends FlowTypes {
        readonly nodes: { task: { title: string }; note: { text: string } };
        readonly edges: { dependency: { weight: number } };
    }

    const features = [connection()] as const;

    const wrong: RootProps<Types, typeof features> = {
        nodes: [
            {
                id: "b",
                type: "task",
                position: { x: 0, y: 0 },
                // @ts-expect-error: a task's data is its registry's
                data: { text: "" },
            },
        ],
    };
    void wrong;

    function titleOf(node: FlowNode<Types>): string {
        return node.type === "task" ? node.data.title : node.data.text;
    }
</script>

<script lang="ts">
    import {
        createFlowModel,
        createFlowRef,
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
        type XY,
    } from "../../src/index.js";
    import { MiniMap } from "../../src/minimap/index.js";
    import { NodeResizer } from "../../src/resize/index.js";

    const Flow = typedFlow<Types, typeof features>();
    const flow = createFlowRef<Types, typeof features>();
    const model = createFlowModel<Types, typeof features>(
        { version: 1, nodes: [], edges: [] },
        { features },
    );
    let nodes: readonly FlowNode<Types>[] = $state.raw(model.get("all-nodes"));

    // the runes, typed by their type arguments
    const typed = useFlow<Types, typeof features>();
    typed.engine.get("connection");
    typed.model.run("node.move", { nodeId: "a", position: { x: 1, y: 2 } });
    const bare = useFlow<Types>();
    // @ts-expect-error: the connection key is connection()'s
    bare.engine.get("connection");
    // @ts-expect-error: no such command
    bare.model.run("node.fly", {});
    const zoom: number = useViewport().current.zoom;
    const first = model.get("node-by", { id: "a" });
    const own = first ? useNode<Types>(first) : undefined;
    const title: string | undefined =
        own?.state.node.type === "task" ? own.state.node.data.title : undefined;
    void [zoom, title];

    // #36's runes, typed by their type arguments
    const count: number = useFlowStore<number, Types, typeof features>(
        ({ model: m, engine }) =>
            m.get("all-nodes").length + engine.get("viewport").zoom,
    ).current;
    const one = useNodesData<Types>("a").current;
    const task: string | undefined =
        one?.type === "task" ? one.data.title : undefined;
    const many = useNodesData<Types>(() => ["a", "b"]).current;
    const manyFirst: string | undefined = many[0]?.id;
    const connections = useNodeConnections({ handleId: "in", type: "target" });
    const edgeId: string | undefined = connections.current[0]?.edgeId;
    // @ts-expect-error: a connection's type is source or target
    useNodeConnections({ type: "in" });
    const width: number | undefined =
        useInternalNode<Types>("a").current?.rect.width;
    const pressed: boolean = useKeyPress(["Meta+s", "Control+s"], {
        target: null,
    }).current;
    const id: string | null = useNodeId();
    useOnViewportChange({
        onend: (viewport, gesture: boolean) => void [viewport.zoom, gesture],
    });
    void [count, task, manyFirst, edgeId, width, pressed, id];
    const tapped = (event: MouseEvent, point: XY) => void [event.button, point.x];
</script>

<Flow.Root
    {model}
    flowRef={flow}
    bind:nodes
    onnodeschange={(next) => next[0]?.type}
    class={(state) => (state.dragging ? "dragging" : undefined)}
    style="height: 100vh"
>
    <Flow.Viewport>
        <Flow.Edges>
            {#snippet children(edge)}
                <Flow.Edge {edge}>
                    <Flow.EdgePath />
                    <Flow.EdgeLabel>
                        {edge.type === "dependency" ? edge.data?.weight : ""}
                    </Flow.EdgeLabel>
                </Flow.Edge>
            {/snippet}
        </Flow.Edges>
        <Flow.Nodes>
            {#snippet children(node)}
                <Flow.Node {node} class={(state) => state.node.type}>
                    {#snippet children({ state })}
                        {titleOf(state.node)}
                        <Flow.Handle type="target" side="top" />
                        <NodeResizer minWidth={40} direction="horizontal" />
                    {/snippet}
                </Flow.Node>
            {/snippet}
        </Flow.Nodes>
        <Flow.ConnectionLine />
        <Flow.NodesSelection class={(state) => (state.dragging ? "moving" : undefined)} />
    </Flow.Viewport>
    <Flow.Controls>
        <Flow.ZoomIn aria-label="Zoom in">
            {#snippet render({ props, state })}
                <button {...props} data-disabled-too={state.disabled}>+</button>
            {/snippet}
        </Flow.ZoomIn>
        <Flow.FitView nodeIds={["a"]} padding="8px" includeHidden minZoom={0.5} maxZoom={2} />
    </Flow.Controls>
    <MiniMap width={200} height={150} inversePan zoomStep={20} onclick={tapped} />
</Flow.Root>
