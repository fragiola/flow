import { Component, signal } from "@angular/core";
import {
    createFlowModel,
    FLOW,
    type FlowEdgeInput,
    type FlowJson,
    type FlowNodeInput,
    type FlowTypes,
} from "@fragiola/flow-angular";
import { drag } from "@fragiola/flow-angular/drag";
import { keyboard } from "@fragiola/flow-angular/keyboard";
import { selection } from "@fragiola/flow-angular/selection";
import type { Shape } from "./border-intersection";
import { FloatingEdge } from "./floating-edge";
import { styles } from "./styles";

// Floating edges: no handle anywhere. Each edge reads its two nodes' boxes as the engine places
// them (`injectInternalNode(id)().rect`, a signal that changes while a node is dragged) and draws
// itself between their borders (`border-intersection.ts`, floating-edge.ts): where the line
// between the centres leaves a rectangle, or the ellipse of a round node, drawn straight or as a
// bezier that leaves and enters square to the side it meets; or, "simple", from the middle of
// each node's side nearest the other. The path itself comes from the core's helpers
// (`straightPath`, `bezierPath`). Pick the variant above the flow; the edges say theirs
// (`data-variant`). The radios' group name holds a number counted per instance of this component
// (Angular has no `useId`), so two of these flows on one page never share it.

export interface Types extends FlowTypes {
    readonly nodes: { shape: { label: string; shape: Shape } };
}

export type Variant = "straight" | "bezier" | "simple";

const VARIANTS: readonly { value: Variant; label: string }[] = [
    { value: "straight", label: "Straight" },
    { value: "bezier", label: "Bezier" },
    { value: "simple", label: "Simple" },
];

const features = [selection(), drag(), keyboard()] as const;

const shape = (
    id: string,
    label: string,
    kind: Shape,
    x: number,
    y: number,
    width: number,
    height: number,
): FlowNodeInput<Types> => ({
    id,
    type: "shape",
    position: { x, y },
    width,
    height,
    data: { label, shape: kind },
});

const link = (source: string, target: string): FlowEdgeInput<Types> => ({
    id: `${source}-${target}`,
    source,
    target,
});

const json: FlowJson<Types> = {
    version: 1,
    nodes: [
        shape("hub", "Hub", "ellipse", 300, 180, 110, 110),
        shape("wide", "Wide box", "rect", 0, 20, 220, 64),
        shape("tall", "Tall box", "rect", 620, 0, 96, 150),
        shape("oval", "Oval", "ellipse", 20, 380, 180, 84),
        shape("square", "Square", "rect", 600, 380, 100, 100),
    ],
    edges: [
        link("hub", "wide"),
        link("hub", "tall"),
        link("oval", "hub"),
        link("square", "hub"),
        link("wide", "oval"),
        link("tall", "square"),
    ],
};

export const LABELS: Record<string, string> = Object.fromEntries(
    json.nodes.map((node) => [node.id, node.data.label]),
);

/** How many of these flows were made: each one's radio group name holds its own number. */
let instances = 0;

@Component({
    selector: "example-floating-edges",
    imports: [FLOW, FloatingEdge],
    host: { class: "contents" },
    template: `
        <div
            flowRoot
            [model]="model"
            [fitView]="{ padding: 0.15, maxZoom: 1 }"
            role="group"
            aria-label="Floating edges"
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
                            exampleFloatingEdge
                            [variant]="variant()"
                            role="group"
                            aria-roledescription="edge"
                            [class]="styles.edgeGroup"
                        ></svg:g>
                    </ng-template>
                </div>
                <div flowNodes>
                    <ng-template [flowNodesItem]="model" let-node>
                        <div
                            [flowNode]="node"
                            role="group"
                            aria-roledescription="node"
                            [attr.aria-label]="node.data.label"
                            [class]="styles.node(node.data.shape)"
                        >
                            {{ node.data.label }}
                        </div>
                    </ng-template>
                </div>
            </div>
            <fieldset [class]="styles.panel">
                <legend [class]="styles.legend">Edge path</legend>
                @for (option of variants; track option.value) {
                    <label [class]="styles.option">
                        <input
                            type="radio"
                            [name]="group"
                            [value]="option.value"
                            [checked]="variant() === option.value"
                            (change)="variant.set(option.value)"
                            [class]="styles.radio"
                        />
                        {{ option.label }}
                    </label>
                }
            </fieldset>
        </div>
    `,
})
export default class FloatingEdges {
    protected readonly styles = styles;
    protected readonly variants = VARIANTS;
    protected readonly variant = signal<Variant>("straight");
    /** the radios' group name, unique to this flow: two of them on a page never share it */
    protected readonly group = `floating-edges-${++instances}`;
    protected readonly model = createFlowModel<Types, typeof features>(json, {
        features,
    });
}
