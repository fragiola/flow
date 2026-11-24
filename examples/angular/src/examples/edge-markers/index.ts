import { Component } from "@angular/core";
import {
    createFlowModel,
    FLOW,
    type FlowEdge,
    type FlowJson,
    type FlowTypes,
} from "@fragiola/flow-angular";
import { drag } from "@fragiola/flow-angular/drag";
import { keyboard } from "@fragiola/flow-angular/keyboard";
import { selection } from "@fragiola/flow-angular/selection";
import {
    describeEnds,
    type Ends,
    GEOMETRY,
    idPrefix,
    type MarkerState,
    markerId,
    markersFor,
    markerUrl,
    type Shape,
} from "./markers";
import { styles } from "./styles";

// No marker is built in: markers are plain SVG. The example defines its own `<marker>`s (arrows,
// open arrows, circles and diamonds, `markers.ts`) in an svg of its own, and points each edge
// path's `marker-start` / `marker-end` at them. A marker is coloured where it is defined, not by
// the path that uses it, so there is one per shape and tone, and one per shape for the selected
// state: selected, the path's `data-selected` swaps to those (`--marker-*-selected`,
// `styles.ts`). The ids start with a number counted per instance of this component (Angular has
// no `useId`), so two of these flows on one page never point at each other's markers.

export interface Types extends FlowTypes {
    readonly nodes: { service: { label: string } };
    readonly edges: {
        marked: Ends;
    };
}

export const features = [selection(), drag(), keyboard()] as const;

const service = (id: string, label: string, x: number, y: number) => ({
    id,
    type: "service" as const,
    position: { x, y },
    data: { label },
});

/** Each edge's ends and tone: what its markers are. */
const MARKED: readonly (readonly [string, string, Ends])[] = [
    ["client", "gateway", { end: "arrow", tone: "neutral" }],
    ["gateway", "auth", { start: "circle", end: "open-arrow", tone: "purple" }],
    ["gateway", "orders", { start: "diamond", end: "arrow", tone: "blue" }],
    ["orders", "database", { start: "arrow", end: "arrow", tone: "orange" }],
    ["orders", "cache", { end: "circle", tone: "green" }],
];

const json: FlowJson<Types> = {
    version: 1,
    nodes: [
        service("client", "Client", 0, 120),
        service("gateway", "Gateway", 240, 120),
        service("auth", "Auth", 500, 0),
        service("orders", "Orders", 500, 240),
        service("database", "Database", 760, 160),
        service("cache", "Cache", 760, 330),
    ],
    edges: MARKED.map(([source, target, data]) => ({
        id: `${source}-${target}`,
        source,
        target,
        type: "marked" as const,
        data,
    })),
};

/** The markers these edges use, each defined once per flow. */
const MARKERS = markersFor(MARKED.map(([, , ends]) => ends));

/** An edge's ends: its data when it is a marked edge, none otherwise. */
const endsOf = (edge: FlowEdge<Types>): Ends =>
    edge.type === "marked" && edge.data ? edge.data : { tone: "neutral" };

const LABELS: Record<string, string> = Object.fromEntries(
    json.nodes.map((node) => [node.id, node.data.label]),
);

/** How many of these flows were made: each one's marker ids start with its own number. */
let instances = 0;

@Component({
    selector: "example-edge-markers",
    imports: [FLOW],
    host: { class: "contents" },
    template: `
        <div
            flowRoot
            [model]="model"
            [fitView]="{ padding: 0.15, maxZoom: 1 }"
            role="group"
            aria-label="Edge markers"
            [class]="styles.root"
        >
            <svg flowBackground variant="dots" [size]="2" [class]="styles.dots"></svg>
            <svg flowBackground variant="lines" [class]="styles.lines"></svg>
            <svg flowBackground variant="cross" [class]="styles.cross"></svg>
            <div flowViewport>
                <div flowEdges>
                    <ng-template [flowEdgesItem]="model" let-edge>
                        @let ends = endsOf(edge);
                        <svg:g
                            [flowEdge]="edge"
                            role="group"
                            aria-roledescription="edge"
                            [attr.aria-label]="edgeLabel(edge)"
                            [class]="styles.edgeGroup"
                        >
                            <!-- a wide transparent path: a bigger target for a click -->
                            <svg:path flowEdgePath [class]="styles.edgeHit" />
                            <svg:path
                                flowEdgePath
                                [attr.marker-start]="url(ends.start, ends.tone)"
                                [attr.marker-end]="url(ends.end, ends.tone)"
                                [style.--marker-start-selected]="url(ends.start, 'selected')"
                                [style.--marker-end-selected]="url(ends.end, 'selected')"
                                [class]="styles.edge(ends.tone)"
                            />
                        </svg:g>
                    </ng-template>
                </div>
                <div flowNodes>
                    <ng-template [flowNodesItem]="model" let-node>
                        <div
                            [flowNode]="node"
                            role="group"
                            aria-roledescription="node"
                            [attr.aria-label]="node.data.label"
                            [class]="styles.node"
                        >
                            <div flowHandle type="target" side="left" [class]="styles.handle"></div>
                            {{ node.data.label }}
                            <div flowHandle type="source" side="right" [class]="styles.handle"></div>
                        </div>
                    </ng-template>
                </div>
            </div>
            <!-- the markers, in an svg of no size: every edge path of this flow points at them -->
            <svg aria-hidden="true" [class]="styles.defs">
                <svg:defs>
                    @for (marker of markers; track marker.shape + '-' + marker.state) {
                        <svg:marker
                            [attr.id]="id(marker.shape, marker.state)"
                            viewBox="0 0 10 10"
                            [attr.refX]="geometry[marker.shape].refX"
                            refY="5"
                            markerWidth="12"
                            markerHeight="12"
                            markerUnits="userSpaceOnUse"
                            orient="auto-start-reverse"
                            [class]="styles.marker(marker.state)"
                        >
                            <svg:path
                                [attr.d]="geometry[marker.shape].d"
                                [class]="geometry[marker.shape].filled ? styles.filled : styles.outlined"
                            />
                        </svg:marker>
                    }
                </svg:defs>
            </svg>
        </div>
    `,
})
export default class EdgeMarkers {
    protected readonly styles = styles;
    protected readonly geometry = GEOMETRY;
    protected readonly markers = MARKERS;
    protected readonly endsOf = endsOf;
    protected readonly model = createFlowModel<Types, typeof features>(json, {
        features,
    });
    /** this flow's marker id prefix, unique on the page */
    private readonly prefix = idPrefix(`${++instances}`);

    protected id(shape: Shape, state: MarkerState): string {
        return markerId(this.prefix, shape, state);
    }

    protected url(
        shape: Shape | undefined,
        state: MarkerState,
    ): string | undefined {
        return markerUrl(this.prefix, shape, state);
    }

    /** An edge's accessible name: its nodes and its ends. */
    protected edgeLabel(edge: FlowEdge<Types>): string {
        return `${LABELS[edge.source]} to ${LABELS[edge.target]}: ${describeEnds(endsOf(edge))}`;
    }
}
