import {
    Flow,
    type FlowEdgeInput,
    type FlowNodeInput,
    type FlowTypes,
} from "@fragiola/flow-react";
import { drag } from "@fragiola/flow-react/drag";
import {
    MiniMap,
    MiniMapMask,
    MiniMapNode,
    minimap,
} from "@fragiola/flow-react/minimap";
import { selection } from "@fragiola/flow-react/selection";
import {
    LockIcon,
    MaximizeIcon,
    MinusIcon,
    PlusIcon,
    UnlockIcon,
} from "lucide-react";
import { styles } from "./styles";

// `minimap()` draws the whole flow small (`MiniMap`): a `MiniMapNode` per node and a `MiniMapMask`
// over what the root does not show; dragging in it pans the flow, the wheel over it zooms.
// `Flow.Controls` groups the buttons; each runs one engine action and is disabled while the engine
// refuses it (at the zoom limits); `duration` animates its change over 200 ms. The lock
// (`Flow.ToggleInteractive`) stops every gesture that changes the flow; pan and zoom stay.

interface Types extends FlowTypes {
    readonly nodes: { city: { label: string } };
}

const features = [selection(), drag(), minimap()] as const;

const CITIES = [
    ["lisbon", "Lisbon", -500, 300],
    ["madrid", "Madrid", -300, 260],
    ["paris", "Paris", -120, -40],
    ["london", "London", -220, -240],
    ["amsterdam", "Amsterdam", 60, -230],
    ["berlin", "Berlin", 300, -170],
    ["prague", "Prague", 320, 30],
    ["vienna", "Vienna", 460, 160],
    ["rome", "Rome", 220, 420],
    ["milan", "Milan", 40, 200],
] as const;

const nodes: FlowNodeInput<Types>[] = CITIES.map(([id, label, x, y]) => ({
    id,
    type: "city",
    position: { x, y },
    data: { label },
}));

const ROUTE = [
    "lisbon",
    "madrid",
    "paris",
    "london",
    "amsterdam",
    "berlin",
    "prague",
    "vienna",
    "rome",
    "milan",
    "paris",
];

const edges: FlowEdgeInput<Types>[] = ROUTE.slice(1).map((target, index) => ({
    id: `${ROUTE[index]}-${target}`,
    source: ROUTE[index] as string,
    target,
    type: "straight",
}));

export default function MinimapAndControls() {
    return (
        <Flow.Root<Types, typeof features>
            features={features}
            defaultNodes={nodes}
            defaultEdges={edges}
            fitView={{ padding: 0.1 }}
            minZoom={0.25}
            maxZoom={2}
            className={styles.root}
        >
            <Flow.Background variant="dots" size={2} className={styles.dots} />
            <Flow.Background variant="lines" className={styles.lines} />
            <Flow.Background variant="cross" className={styles.cross} />
            <Flow.Viewport>
                <Flow.Edges<Types>>
                    {(edge) => (
                        <Flow.Edge<Types> edge={edge}>
                            <Flow.EdgePath className={styles.edge} />
                        </Flow.Edge>
                    )}
                </Flow.Edges>
                <Flow.Nodes<Types>>
                    {(node) => (
                        <Flow.Node<Types> node={node} className={styles.node}>
                            {node.data.label}
                            <Flow.Handle
                                type="target"
                                side="top"
                                className={styles.anchor}
                            />
                            <Flow.Handle
                                type="source"
                                side="bottom"
                                className={styles.anchor}
                            />
                        </Flow.Node>
                    )}
                </Flow.Nodes>
            </Flow.Viewport>
            <Flow.Controls
                role="group"
                aria-label="Zoom and lock"
                className={styles.controls}
            >
                <Flow.ZoomIn
                    duration={200}
                    aria-label="Zoom in"
                    className={styles.control}
                >
                    <PlusIcon />
                </Flow.ZoomIn>
                <Flow.ZoomOut
                    duration={200}
                    aria-label="Zoom out"
                    className={styles.control}
                >
                    <MinusIcon />
                </Flow.ZoomOut>
                <Flow.FitView
                    duration={200}
                    aria-label="Fit view"
                    className={styles.control}
                >
                    <MaximizeIcon />
                </Flow.FitView>
                <Flow.ToggleInteractive
                    aria-label="Lock the flow"
                    className={styles.control}
                    render={(props, state) => (
                        <button {...props}>
                            {state.interactive ? <UnlockIcon /> : <LockIcon />}
                        </button>
                    )}
                />
            </Flow.Controls>
            <MiniMap
                width={180}
                height={130}
                role="img"
                aria-label="Minimap of the route"
                className={styles.minimap}
            >
                {(view) => (
                    <>
                        {view.nodes.map((node) => (
                            <MiniMapNode
                                key={node.nodeId}
                                nodeId={node.nodeId}
                                className={styles.minimapNode}
                            />
                        ))}
                        <MiniMapMask className={styles.minimapMask} />
                    </>
                )}
            </MiniMap>
        </Flow.Root>
    );
}
