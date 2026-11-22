import { Component } from "@angular/core";
import {
    createFlowModel,
    type EdgePath,
    FLOW,
    type FlowEdge,
    type FlowEdgeInput,
    type FlowNodeInput,
    type FlowTypes,
} from "@fragiola/flow-angular";
import { drag } from "@fragiola/flow-angular/drag";
import { selection } from "@fragiola/flow-angular/selection";
import { styles } from "./styles";

// The edge's `type` picks its path: the core draws `bezier` (the default), `simplebezier` (one
// curve, its control points halfway on each end's axis), `smoothstep`, `step` and `straight`. Any
// other type is the app's: `flowEdgePath` takes a `d` of your own, drawn here from the edge's ends
// (`#e="flowEdge"`, `e.state()?.path`) as a wave. An edge's own `pathOptions` shape it over the
// root's (the step turns a quarter of the way down, the smooth step's corners are rounder), and
// `animated` marks it `data-animated` for its style (the smooth step pulses). Drag the nodes to see
// each path follow.

interface Types extends FlowTypes {
    readonly nodes: { point: { label: string } };
    readonly edges: { wave: { amplitude: number } };
}

const features = [selection(), drag()] as const;

const TYPES = [
    "bezier",
    "simplebezier",
    "smoothstep",
    "step",
    "straight",
    "wave",
] as const;

/** What some edges set of their own: their path's shape, and an animated one. */
const EDGE_OPTIONS: Partial<
    Record<(typeof TYPES)[number], Partial<FlowEdgeInput<Types>>>
> = {
    step: { pathOptions: { stepPosition: 0.25 } },
    smoothstep: { animated: true, pathOptions: { borderRadius: 16 } },
};

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
        : {
              id: type,
              source: `${type}-a`,
              target: `${type}-b`,
              type,
              ...EDGE_OPTIONS[type],
          },
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

@Component({
    selector: "example-edge-types",
    imports: [FLOW],
    host: { class: "contents" },
    template: `
        <div flowRoot [model]="model" [fitView]="{ padding: 0.15 }" [class]="styles.root">
            <svg flowBackground variant="dots" [size]="2" [class]="styles.dots"></svg>
            <svg flowBackground variant="lines" [class]="styles.lines"></svg>
            <svg flowBackground variant="cross" [class]="styles.cross"></svg>
            <div flowViewport>
                <div flowEdges>
                    <ng-template [flowEdgesItem]="model" let-edge>
                        <!-- an app type (the wave) draws its own d from the edge's ends -->
                        <svg:g [flowEdge]="edge" #e="flowEdge">
                            <svg:path flowEdgePath [attr.d]="wave(edge, e.state()?.path)" [class]="styles.edge" />
                            <xhtml:div flowEdgeLabel [class]="styles.label">
                                {{ edge.type === "wave" ? "wave (app)" : (edge.type ?? "bezier") }}
                            </xhtml:div>
                        </svg:g>
                    </ng-template>
                </div>
                <div flowNodes>
                    <ng-template [flowNodesItem]="model" let-node>
                        <div [flowNode]="node" [class]="styles.node">
                            {{ node.data.label }}
                            <div flowHandle type="target" side="top" [class]="styles.handle"></div>
                            <div flowHandle type="source" side="bottom" [class]="styles.handle"></div>
                        </div>
                    </ng-template>
                </div>
            </div>
        </div>
    `,
})
export default class EdgeTypes {
    protected readonly styles = styles;
    protected readonly model = createFlowModel<Types, typeof features>(
        { version: 1, nodes, edges },
        { features },
    );

    /** the wave's `d`, once the edge has its ends; the core's path for the core's types */
    protected wave(
        edge: FlowEdge<Types>,
        path: EdgePath | undefined,
    ): string | null {
        if (!path || edge.type !== "wave") return null;
        return wavePath(path, edge.data?.amplitude ?? 8);
    }
}
