import {
    type EdgePath,
    Flow,
    type FlowEdge,
    type FlowEdgeInput,
    type FlowNodeInput,
    type FlowTypes,
    useEdge,
} from "@fragiola/flow-react";
import { drag } from "@fragiola/flow-react/drag";
import { selection } from "@fragiola/flow-react/selection";
import { styles } from "./styles";

// The edge's `type` picks its path: the core draws `bezier` (the default), `smoothstep`, `step` and
// `straight`. Any other type is the app's: `Flow.EdgePath` takes a `d` of your own, drawn here from
// the edge's ends (`useEdge(edge).state.path`) as a wave. Drag the nodes to see each path follow.

interface Types extends FlowTypes {
    readonly nodes: { point: { label: string } };
    readonly edges: { wave: { amplitude: number } };
}

const features = [selection(), drag()] as const;

const TYPES = ["bezier", "smoothstep", "step", "straight", "wave"] as const;

const nodes: FlowNodeInput<Types>[] = TYPES.flatMap((type, index) => [
    {
        id: `${type}-a`,
        type: "point",
        position: { x: index * 170, y: 0 },
        data: { label: "Source" },
    },
    {
        id: `${type}-b`,
        type: "point",
        position: { x: index * 170 + 60, y: 200 },
        data: { label: "Target" },
    },
]);

const edges: FlowEdgeInput<Types>[] = TYPES.map((type) =>
    type === "wave"
        ? {
              id: type,
              source: `${type}-a`,
              target: `${type}-b`,
              type,
              data: { amplitude: 10 },
          }
        : { id: type, source: `${type}-a`, target: `${type}-b`, type },
);

/** A wave between the two ends: a sine of `amplitude` pixels across the straight line. */
function wavePath(path: EdgePath, amplitude: number): string {
    const { source, target } = path;
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const length = Math.hypot(dx, dy) || 1;
    // the unit normal to the line
    const nx = -dy / length;
    const ny = dx / length;
    const waves = Math.max(1, Math.round(length / 60));
    const steps = waves * 16;
    const points: string[] = [];
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const offset = Math.sin(t * waves * 2 * Math.PI) * amplitude;
        points.push(
            `${source.x + dx * t + nx * offset},${source.y + dy * t + ny * offset}`,
        );
    }
    return `M ${points.join(" L ")}`;
}

function WaveEdge({
    edge,
}: {
    edge: Extract<FlowEdge<Types>, { type?: "wave" }>;
}) {
    const { state } = useEdge<Types>(edge);
    if (!state.path) return null;
    return (
        <Flow.Edge<Types> edge={edge}>
            <Flow.EdgePath
                d={wavePath(state.path, edge.data?.amplitude ?? 8)}
                className={styles.edge}
            />
            <Flow.EdgeLabel className={styles.label}>wave (app)</Flow.EdgeLabel>
        </Flow.Edge>
    );
}

function renderEdge(edge: FlowEdge<Types>) {
    if (edge.type === "wave") return <WaveEdge edge={edge} />;
    return (
        <Flow.Edge<Types> edge={edge}>
            <Flow.EdgePath className={styles.edge} />
            <Flow.EdgeLabel className={styles.label}>
                {edge.type ?? "bezier"}
            </Flow.EdgeLabel>
        </Flow.Edge>
    );
}

export default function EdgeTypes() {
    return (
        <Flow.Root<Types, typeof features>
            features={features}
            defaultNodes={nodes}
            defaultEdges={edges}
            fitView={{ padding: 0.15 }}
            className={styles.root}
        >
            <Flow.Background variant="dots" size={2} className={styles.dots} />
            <Flow.Background variant="lines" className={styles.lines} />
            <Flow.Background variant="cross" className={styles.cross} />
            <Flow.Viewport>
                <Flow.Edges<Types>>{renderEdge}</Flow.Edges>
                <Flow.Nodes<Types>>
                    {(node) => (
                        <Flow.Node<Types> node={node} className={styles.node}>
                            {node.data.label}
                            <Flow.Handle
                                type="target"
                                side="top"
                                className={styles.handle}
                            />
                            <Flow.Handle
                                type="source"
                                side="bottom"
                                className={styles.handle}
                            />
                        </Flow.Node>
                    )}
                </Flow.Nodes>
            </Flow.Viewport>
        </Flow.Root>
    );
}
