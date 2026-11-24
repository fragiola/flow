import { Component } from "@angular/core";
import {
    createFlowModel,
    FLOW,
    type FlowJson,
    type FlowTypes,
    type Middleware,
    veto,
} from "@fragiola/flow-angular";
import { connection } from "@fragiola/flow-angular/connection";
import { drag } from "@fragiola/flow-angular/drag";
import { keyboard } from "@fragiola/flow-angular/keyboard";
import { selection } from "@fragiola/flow-angular/selection";
import { FloatingEdge } from "./floating-edge-view";
import { styles } from "./styles";

// No small dots to aim at: the whole node is its target, and its border its source. Each node has
// two handles as large as itself: an invisible target handle over all of it, and a source handle
// that is the ring around its body (press the body to drag the node, its border to connect). With
// `mode: "loose"` a connection may end at any handle of another node, and a drop snaps to the
// nearest handle within `radius`: a radius as large as half a node makes anywhere on a node a
// drop. With `clickToConnect`, a tap on a border starts a connection that follows the pointer, and
// a tap on another node ends it. On a touch screen (`pointer: coarse`) the ring grows. Both handles
// sit at the node's centre, so an edge is drawn as a floating line between the borders
// (`floating-edge.ts`, floating-edge-view.ts). A middleware refuses an edge from a node to itself.
// The handles' `revert-layer` style hands their place back to the classes: they cover the node,
// whatever their side.

export interface Types extends FlowTypes {
    readonly nodes: { step: { label: string } };
}

/** Every node's size: the floating edges cut their line at it. */
export const NODE = { width: 140, height: 56 };

const features = [
    selection(),
    drag(),
    connection({
        mode: "loose",
        clickToConnect: true,
        // half a node's diagonal: a drop anywhere on it reaches its centre's handles
        radius: Math.ceil(Math.hypot(NODE.width, NODE.height) / 2) + 4,
        lineType: "straight",
    }),
    keyboard(),
] as const;

/** A node never connects to itself (its own handles are as near as any while you start). */
const noSelfLoop: Middleware<Types, typeof features> = (ctx, next) =>
    ctx.command === "edge.add" && ctx.payload.source === ctx.payload.target
        ? veto("a node does not connect to itself")
        : next();

const step = (id: string, label: string, x: number, y: number) => ({
    id,
    type: "step" as const,
    position: { x, y },
    ...NODE,
    data: { label },
});

const json: FlowJson<Types> = {
    version: 1,
    nodes: [
        step("idea", "Idea", 0, 0),
        step("sketch", "Sketch", 240, 0),
        step("build", "Build", 480, 0),
        step("test", "Test", 120, 170),
        step("ship", "Ship", 380, 170),
    ],
    edges: [{ id: "idea-sketch", source: "idea", target: "sketch" }],
};

/** The node's labels, for the edges' names. */
const LABELS: Record<string, string> = Object.fromEntries(
    json.nodes.map((node) => [node.id, node.data.label]),
);

/** The model, made once with its middleware. */
function createModel() {
    const model = createFlowModel<Types, typeof features>(json, { features });
    model.use(noSelfLoop);
    return model;
}

@Component({
    selector: "example-easy-connect",
    imports: [FLOW, FloatingEdge],
    host: { class: "contents" },
    template: `
        <div
            flowRoot
            [model]="model"
            [fitView]="{ padding: 0.2, maxZoom: 1 }"
            role="group"
            aria-label="Easy connect"
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
                            role="group"
                            aria-roledescription="edge"
                            [attr.aria-label]="label(edge.source) + ' to ' + label(edge.target)"
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
                            [class]="styles.node"
                        >
                            <!-- a handle as large as its node: the classes place it, not its side -->
                            <div
                                flowHandle
                                type="target"
                                side="top"
                                [connectableStart]="false"
                                [style.top]="cover"
                                [style.left]="cover"
                                [style.transform]="cover"
                                [class]="styles.target"
                            ></div>
                            <div
                                flowHandle
                                type="source"
                                side="bottom"
                                [attr.aria-label]="'Connect from ' + node.data.label"
                                [style.top]="cover"
                                [style.left]="cover"
                                [style.transform]="cover"
                                [class]="styles.source"
                            ></div>
                            <div [class]="styles.body">{{ node.data.label }}</div>
                        </div>
                    </ng-template>
                </div>
                <svg flowConnectionLine [class]="styles.connection"></svg>
            </div>
            <p [class]="styles.hint">
                Drag from a node's border onto another node, or tap a border and then another node
            </p>
        </div>
    `,
})
export default class EasyConnect {
    protected readonly styles = styles;
    /** hands a handle's side placement back to its classes (React's `undefined` keys) */
    protected readonly cover = "revert-layer";
    // the model is made once, with its middleware, and handed to the root
    protected readonly model = createModel();

    protected label(id: string): string {
        return LABELS[id] ?? id;
    }
}
