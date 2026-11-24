import { Component } from "@angular/core";
import {
    createFlowModel,
    FLOW,
    type FlowEdgeInput,
    type FlowJson,
    type FlowTypes,
} from "@fragiola/flow-angular";
import { drag } from "@fragiola/flow-angular/drag";
import { keyboard } from "@fragiola/flow-angular/keyboard";
import { selection } from "@fragiola/flow-angular/selection";
import {
    LucideBellRing,
    LucideBraces,
    LucideDatabase,
    LucideDynamicIcon,
    LucideFileText,
    type LucideIcon,
    LucideShieldCheck,
} from "@lucide/angular";
import { GradientEdge } from "./gradient-edge";
import { describeStep, idPrefix, type Kind } from "./gradients";
import { styles } from "./styles";

// A look of the app's own, every colour a palette's accent so it follows the five themes. A node's
// border is a gradient between two palettes (its kind's, `gradients.ts`): the node sits in the
// first, a frame inside it in the second, and the frame paints the gradient around the body.
// Selected (`data-selected`), the node glows in its own colour. An edge's stroke is an SVG
// `<linearGradient>` of its own (gradient-edge.ts), from its source's colour to its target's:
// drawn in flow coordinates (`userSpaceOnUse`) between the edge's ends (`flowEdge`'s
// `state().path`), so it keeps its direction while a node moves, and a straight edge (whose box
// has no height) still paints. Its id starts with a number counted per instance of this component
// (Angular has no `useId`), so two of these flows on one page never share one.

export interface Types extends FlowTypes {
    readonly nodes: {
        step: { label: string; kind: Kind; detail: string };
    };
}

const features = [selection(), drag(), keyboard()] as const;

const step = (
    id: string,
    label: string,
    kind: Kind,
    detail: string,
    x: number,
    y: number,
) => ({
    id,
    type: "step" as const,
    position: { x, y },
    data: { label, kind, detail },
});

const ICONS: Record<string, LucideIcon> = {
    events: LucideDatabase,
    parse: LucideBraces,
    validate: LucideShieldCheck,
    report: LucideFileText,
    alerts: LucideBellRing,
};

const link = (source: string, target: string) => ({
    id: `${source}-${target}`,
    source,
    target,
});

const edges: FlowEdgeInput<Types>[] = [
    link("events", "parse"),
    link("parse", "validate"),
    link("validate", "report"),
    link("validate", "alerts"),
];

const json: FlowJson<Types> = {
    version: 1,
    nodes: [
        step("events", "Events", "source", "events.ndjson", 0, 120),
        step("parse", "Parse", "transform", "JSON lines to rows", 300, 120),
        step("validate", "Validate", "check", "against the schema", 600, 120),
        step("report", "Report", "output", "daily summary", 900, 20),
        step("alerts", "Alerts", "output", "on rejected rows", 900, 220),
    ],
    edges,
};

/** Each step's data, by node id: what an edge names and colours itself by. */
export const STEPS = Object.fromEntries(
    json.nodes.map((node) => [node.id, node.data]),
);

/** How many of these flows were made: each one's gradient ids start with its own number. */
let instances = 0;

@Component({
    selector: "example-gradient-styling",
    imports: [FLOW, GradientEdge, LucideDynamicIcon],
    host: { class: "contents" },
    template: `
        <div
            flowRoot
            [model]="model"
            [fitView]="{ padding: 0.15, maxZoom: 1 }"
            role="group"
            aria-label="Gradient styling"
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
                            exampleGradientEdge
                            [prefix]="prefix"
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
                            [attr.aria-label]="describe(node.data.label, node.data.kind, node.data.detail)"
                            [class]="styles.node(node.data.kind)"
                        >
                            <div flowHandle type="target" side="left" [class]="styles.handle"></div>
                            <div [class]="styles.frame(node.data.kind)">
                                <div [class]="styles.body">
                                    <span [class]="styles.icon">
                                        <svg [lucideIcon]="iconOf(node.id)" aria-hidden="true"></svg>
                                    </span>
                                    <span [class]="styles.text">
                                        <span [class]="styles.title">{{ node.data.label }}</span>
                                        <span [class]="styles.detail">{{ node.data.detail }}</span>
                                    </span>
                                </div>
                            </div>
                            <div flowHandle type="source" side="right" [class]="styles.handle"></div>
                        </div>
                    </ng-template>
                </div>
            </div>
        </div>
    `,
})
export default class GradientStyling {
    protected readonly styles = styles;
    protected readonly describe = describeStep;
    /** this flow's gradient id prefix, unique on the page */
    protected readonly prefix = idPrefix(`${++instances}`);
    protected readonly model = createFlowModel<Types, typeof features>(json, {
        features,
    });

    /** A node's icon, by its id. */
    protected iconOf(nodeId: string): LucideIcon {
        return ICONS[nodeId] ?? LucideBraces;
    }
}
