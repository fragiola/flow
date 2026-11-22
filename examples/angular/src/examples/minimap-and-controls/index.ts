import { Component, inject } from "@angular/core";
import {
    createFlowModel,
    FLOW,
    type FlowEdgeInput,
    type FlowNodeInput,
    type FlowTypes,
} from "@fragiola/flow-angular";
import { drag } from "@fragiola/flow-angular/drag";
import {
    FLOW_MINIMAP,
    FlowMiniMapDirective,
    minimap,
} from "@fragiola/flow-angular/minimap";
import { selection } from "@fragiola/flow-angular/selection";
import {
    LucideLock,
    LucideLockOpen,
    LucideMaximize,
    LucideMinus,
    LucidePlus,
} from "@lucide/angular";
import { styles } from "./styles";

// `minimap()` draws the whole flow small (`flowMiniMap`): a `flowMiniMapNode` per node and a `flowMiniMapMask`
// over what the root does not show; dragging in it pans the flow, the wheel over it zooms.
// `flowControls` groups the buttons; each runs one engine action and is disabled while the engine
// refuses it (at the zoom limits); `duration` animates its change over 200 ms. The lock (`flowToggleInteractive`) stops every gesture that
// changes the flow; pan and zoom stay.

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

/**
 * The minimap's content: a `flowMiniMapNode` per node and the mask, from the minimap's view. A
 * component of its own, on the minimap's element: its view changes on every pan and drag step, and
 * only this template reads it (in the example's template it would check every node again).
 */
@Component({
    selector: "svg[exampleRouteMinimap]",
    imports: [FLOW_MINIMAP],
    template: `
        @for (item of map.state().view.nodes; track item.nodeId) {
            <!-- a minimap node leaves the document until it is measured: a group keeps its place -->
            <svg:g><svg:rect flowMiniMapNode [nodeId]="item.nodeId" [class]="styles.minimapNode" /></svg:g>
        }
        <svg:path flowMiniMapMask [class]="styles.minimapMask" />
    `,
})
class RouteMinimap {
    protected readonly styles = styles;
    protected readonly map = inject(FlowMiniMapDirective);
}

@Component({
    selector: "example-minimap-and-controls",
    imports: [
        FLOW,
        FLOW_MINIMAP,
        RouteMinimap,
        LucideLock,
        LucideLockOpen,
        LucideMaximize,
        LucideMinus,
        LucidePlus,
    ],
    host: { class: "contents" },
    template: `
        <div
            flowRoot
            [model]="model"
            [fitView]="{ padding: 0.1 }"
            [minZoom]="0.25"
            [maxZoom]="2"
            [class]="styles.root"
        >
            <svg flowBackground variant="dots" [size]="2" [class]="styles.dots"></svg>
            <svg flowBackground variant="lines" [class]="styles.lines"></svg>
            <svg flowBackground variant="cross" [class]="styles.cross"></svg>
            <div flowViewport>
                <div flowEdges>
                    <ng-template [flowEdgesItem]="model" let-edge>
                        <svg:g [flowEdge]="edge">
                            <svg:path flowEdgePath [class]="styles.edge" />
                        </svg:g>
                    </ng-template>
                </div>
                <div flowNodes>
                    <ng-template [flowNodesItem]="model" let-node>
                        <div [flowNode]="node" [class]="styles.node">
                            {{ node.data.label }}
                            <div flowHandle type="target" side="top" [class]="styles.anchor"></div>
                            <div flowHandle type="source" side="bottom" [class]="styles.anchor"></div>
                        </div>
                    </ng-template>
                </div>
            </div>
            <div flowControls role="group" aria-label="Zoom and lock" [class]="styles.controls">
                <button flowZoomIn [duration]="200" aria-label="Zoom in" [class]="styles.control">
                    <svg lucidePlus aria-hidden="true"></svg>
                </button>
                <button flowZoomOut [duration]="200" aria-label="Zoom out" [class]="styles.control">
                    <svg lucideMinus aria-hidden="true"></svg>
                </button>
                <button flowFitView [duration]="200" aria-label="Fit view" [class]="styles.control">
                    <svg lucideMaximize aria-hidden="true"></svg>
                </button>
                <button
                    flowToggleInteractive
                    #lock="flowToggleInteractive"
                    aria-label="Lock the flow"
                    [class]="styles.control"
                >
                    @if (lock.state().interactive) {
                        <svg lucideLockOpen aria-hidden="true"></svg>
                    } @else {
                        <svg lucideLock aria-hidden="true"></svg>
                    }
                </button>
            </div>
            <svg
                flowMiniMap
                exampleRouteMinimap
                [width]="180"
                [height]="130"
                role="img"
                aria-label="Minimap of the route"
                [class]="styles.minimap"
            ></svg>
        </div>
    `,
})
export default class MinimapAndControls {
    protected readonly styles = styles;
    protected readonly model = createFlowModel<Types, typeof features>(
        { version: 1, nodes, edges },
        { features },
    );
}
