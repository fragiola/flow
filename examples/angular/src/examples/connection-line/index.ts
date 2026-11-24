import { Component, signal } from "@angular/core";
import {
    createFlowModel,
    FLOW,
    type FlowEngineEventOf,
    type FlowJson,
    type FlowTypes,
    type Middleware,
    veto,
} from "@fragiola/flow-angular";
import { connection } from "@fragiola/flow-angular/connection";
import { drag } from "@fragiola/flow-angular/drag";
import { keyboard } from "@fragiola/flow-angular/keyboard";
import { selection } from "@fragiola/flow-angular/selection";
import { Lines } from "./lines";
import { edgesToAdd, otherSources } from "./multi-connection";
import { styles } from "./styles";

// A connection line of the app's own: the elements inside `flowConnectionLine` draw it, an elbow
// with a ring at its end (`multi-connection.ts`, lines.ts, a component on the line's element that
// reads its `state()?.connection`, so a pointer move checks that view alone), and read the line's
// `data-valid` / `data-invalid` to colour it (a locked node, or an edge that exists already, is
// refused by a middleware). And a connection from several nodes at once, which the library does
// not have: with several nodes selected (Shift-click), a drag from one of their handles draws a
// line from each of them (the other lines come from `injectFlowStore`: the selection and each
// node's source handle), and when the drop adds the edge (`connect`, `(connect)`) the example adds
// the others in one `batch`.

export interface Types extends FlowTypes {
    readonly nodes: { device: { label: string; locked: boolean } };
}

export const features = [
    selection(),
    drag(),
    connection(),
    keyboard(),
] as const;
/** Refuses an edge into a locked node, and an edge that exists already. */
const rules: Middleware<Types, typeof features> = (ctx, next) => {
    if (ctx.command !== "edge.add") return next();
    const { source, target, targetHandle } = ctx.payload;
    const into = ctx.state.nodes.find((node) => node.id === target);
    if (into?.data.locked) return veto("a locked node takes no new edge");
    const taken = ctx.state.edges.some(
        (edge) =>
            edge.source === source &&
            edge.target === target &&
            edge.targetHandle === targetHandle,
    );
    return taken ? veto("that edge exists already") : next();
};

const device = (
    id: string,
    label: string,
    x: number,
    y: number,
    locked = false,
) => ({
    id,
    type: "device" as const,
    position: { x, y },
    width: 140,
    height: 48,
    data: { label, locked },
});

const json: FlowJson<Types> = {
    version: 1,
    nodes: [
        device("camera", "Camera", 0, 0),
        device("microphone", "Microphone", 0, 100),
        device("sensor", "Sensor", 0, 200),
        device("recorder", "Recorder", 380, 20),
        device("monitor", "Monitor", 380, 130),
        device("archive", "Archive (locked)", 380, 240, true),
    ],
    edges: [{ id: "camera-recorder", source: "camera", target: "recorder" }],
};

/** The node's labels, for the names. */
const LABELS: Record<string, string> = Object.fromEntries(
    json.nodes.map((node) => [node.id, node.data.label]),
);
const label = (id: string) => LABELS[id] ?? id;

/** The model, made once with its middleware. */
function createModel() {
    const model = createFlowModel<Types, typeof features>(json, { features });
    model.use(rules);
    return model;
}

@Component({
    selector: "example-connection-line",
    imports: [FLOW, Lines],
    host: { class: "contents" },
    template: `
        <div
            flowRoot
            [model]="model"
            [fitView]="{ padding: 0.2, maxZoom: 1 }"
            (connect)="onConnect($event)"
            (connectCancel)="onConnectCancel($event)"
            role="group"
            aria-label="Connection line"
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
                            [attr.aria-label]="name(edge.source) + ' to ' + name(edge.target)"
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
                            [class]="styles.node(node.data.locked)"
                        >
                            <div
                                flowHandle
                                type="target"
                                side="left"
                                [attr.aria-label]="'Into ' + node.data.label"
                                [class]="styles.handle"
                            ></div>
                            {{ node.data.label }}
                            <div
                                flowHandle
                                type="source"
                                side="right"
                                [attr.aria-label]="'Connect from ' + node.data.label"
                                [class]="styles.handle"
                            ></div>
                        </div>
                    </ng-template>
                </div>
                <svg flowConnectionLine exampleLines [class]="styles.connection"></svg>
            </div>
            <p role="status" data-testid="outcome" [class]="styles.status">{{ outcome() }}</p>
        </div>
    `,
})
export default class ConnectionLine {
    protected readonly styles = styles;
    // the model is made once, with its middleware, and handed to the root
    protected readonly model = createModel();
    protected readonly outcome = signal(
        "Shift-click nodes to select several, then drag from one of their handles.",
    );

    protected name(id: string): string {
        return label(id);
    }

    /** The drop added one edge: the other selected nodes get theirs, in one batch. */
    protected onConnect(event: FlowEngineEventOf<"connect">): void {
        const model = this.model;
        const added = model.get("edge-by", { id: event.edgeId });
        const sources = otherSources(
            event.source,
            model.get("selected-nodes").map((node) => node.id),
        );
        const more = edgesToAdd(
            sources,
            event.target,
            added?.targetHandle,
            model.get("all-edges"),
        ).filter((edge) => model.can("edge.add", edge));
        if (more.length > 0) {
            model.run("batch", {
                commands: more.map((edge) => ({
                    command: "edge.add" as const,
                    payload: edge,
                })),
            });
        }
        const from = [event.source, ...more.map((edge) => edge.source)];
        this.outcome.set(
            `Connected ${from.map(label).join(", ")} to ${label(event.target)}.`,
        );
    }

    protected onConnectCancel(
        event: FlowEngineEventOf<"connect-cancel">,
    ): void {
        if (event.refused)
            this.outcome.set("Refused: that target takes no edge.");
    }
}
