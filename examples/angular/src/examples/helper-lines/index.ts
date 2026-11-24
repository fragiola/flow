import { Component } from "@angular/core";
import {
    createFlowModel,
    FLOW,
    type FlowJson,
    type FlowTypes,
} from "@fragiola/flow-angular";
import { drag } from "@fragiola/flow-angular/drag";
import { keyboard } from "@fragiola/flow-angular/keyboard";
import { selection } from "@fragiola/flow-angular/selection";
import { HelperLines } from "./helper-lines";
import { snapToLines } from "./snapping";
import { styles } from "./styles";

// Helper lines: while a node is dragged alone, a guide is drawn wherever one of its edges or its
// centre lines up with another node's, and the node snaps onto those lines when it comes within
// `SNAP` flow units of them. The snap is a middleware (`snapping.ts`, `model.use`): it rewrites the
// position of the drag's `node.move` steps (run as `transient`) and of the drop, so the document
// only ever holds the snapped position. The guides are the example's own state, never the
// document's: a store (`injectFlowStore`, helper-lines.ts) reads the dragged node
// (`dragging-node-ids`) and where it lines up now (`alignment.ts`), and draws them in flow
// coordinates inside the viewport; the drop ends the drag and clears them.

export interface Types extends FlowTypes {
    readonly nodes: { card: { label: string } };
}

export const features = [selection(), drag(), keyboard()] as const;

/** How near (flow units) a dragged node's line must come to another's to snap onto it. */
const SNAP = 8;

/** How far (flow units) a guide runs past the boxes it joins. */
export const OVERHANG = 12;

const card = (
    id: string,
    label: string,
    x: number,
    y: number,
    width: number,
    height: number,
) => ({
    id,
    type: "card" as const,
    position: { x, y },
    width,
    height,
    data: { label },
});

const json: FlowJson<Types> = {
    version: 1,
    nodes: [
        card("draft", "Draft", 0, 0, 160, 60),
        card("review", "Review", 280, 110, 120, 80),
        card("publish", "Publish", 36, 250, 180, 60),
    ],
    edges: [
        { id: "draft-review", source: "draft", target: "review" },
        { id: "review-publish", source: "review", target: "publish" },
    ],
};

/** The node's labels, for the edges' names. */
const LABELS: Record<string, string> = Object.fromEntries(
    json.nodes.map((node) => [node.id, node.data.label]),
);

/** A position as the node prints it: a tenth at most. */
const printed = (value: number) => Number(value.toFixed(1));

/** The model, made once with the snap as its middleware. */
function createModel() {
    const model = createFlowModel<Types, typeof features>(json, { features });
    model.use(snapToLines(SNAP));
    return model;
}

@Component({
    selector: "example-helper-lines",
    imports: [FLOW, HelperLines],
    host: { class: "contents" },
    template: `
        <div
            flowRoot
            [model]="model"
            [fitView]="{ padding: 0.2, maxZoom: 1 }"
            role="group"
            aria-label="Helper lines"
            [class]="styles.root"
        >
            <svg flowBackground variant="dots" [size]="2" [class]="styles.dots"></svg>
            <svg flowBackground variant="lines" [class]="styles.lines"></svg>
            <svg flowBackground variant="cross" [class]="styles.cross"></svg>
            <div flowViewport>
                <div flowEdges>
                    <ng-template [flowEdgesItem]="model" let-edge>
                        <svg:g
                            [flowEdge]="edge"
                            role="group"
                            aria-roledescription="edge"
                            [attr.aria-label]="label(edge.source) + ' to ' + label(edge.target)"
                            [class]="styles.edgeGroup"
                        >
                            <svg:path flowEdgePath [class]="styles.edge" />
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
                            <span data-testid="position" [class]="styles.position">
                                {{ printed(node.position.x) }}, {{ printed(node.position.y) }}
                            </span>
                            <div flowHandle type="source" side="right" [class]="styles.handle"></div>
                        </div>
                    </ng-template>
                </div>
                <example-guides />
            </div>
            <p [class]="styles.hint">Drag a node until its edges or centre line up with another one</p>
        </div>
    `,
})
export default class HelperLinesExample {
    protected readonly styles = styles;
    protected readonly printed = printed;
    protected readonly model = createModel();

    protected label(id: string): string {
        return LABELS[id] ?? id;
    }
}
