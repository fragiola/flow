import { Component } from "@angular/core";
import {
    createFlowModel,
    FLOW,
    type FlowEdge,
    type FlowJson,
    type FlowTypes,
    type Middleware,
    veto,
} from "@fragiola/flow-angular";
import { connection } from "@fragiola/flow-angular/connection";
import { drag } from "@fragiola/flow-angular/drag";
import { selection } from "@fragiola/flow-angular/selection";
import { Outcome } from "./flow-outcome";
import { styles } from "./styles";

// Connection rules are middleware, not a callback: `model.use` sees every `edge.add`, from a drag
// or from code, and vetoes what it refuses. While a connection is drawn, the engine asks the model
// (`model.can("edge.add", …)`), so a refused handle is marked `data-invalid` before the drop and the
// drop adds nothing. The rules: a port joins a port of its own type, no cycle, one edge per input.

export type Port = "number" | "text";

export const PORTS: Port[] = ["number", "text"];

export interface Types extends FlowTypes {
    readonly nodes: {
        block: { label: string; inputs: Port[]; outputs: Port[] };
    };
}

export const features = [selection(), drag(), connection()] as const;

/** A handle id says its port's type: `number-0`, `text-1`. */
const portType = (handleId: string | undefined) =>
    handleId?.split("-")[0] as Port | undefined;

/** Whether `to` reaches `from` already: an edge from `from` to `to` would close a cycle. */
function reaches(
    edges: readonly FlowEdge<Types>[],
    to: string,
    from: string,
): boolean {
    const seen = new Set<string>();
    const queue = [to];
    while (queue.length > 0) {
        const id = queue.shift() as string;
        if (id === from) return true;
        if (seen.has(id)) continue;
        seen.add(id);
        for (const edge of edges)
            if (edge.source === id) queue.push(edge.target);
    }
    return false;
}

/** The rules, as a middleware: anything it returns without calling `next` is a veto. */
const connectionRules: Middleware<Types, typeof features> = (ctx, next) => {
    if (ctx.command !== "edge.add") return next();
    const { source, target, sourceHandle, targetHandle } = ctx.payload;
    if (portType(sourceHandle) !== portType(targetHandle)) {
        return veto("a port only joins a port of its own type");
    }
    if (source === target || reaches(ctx.state.edges, target, source)) {
        return veto("that edge would close a cycle");
    }
    const taken = ctx.state.edges.some(
        (edge) => edge.target === target && edge.targetHandle === targetHandle,
    );
    if (taken) return veto("that input already has an edge");
    return next();
};

const json: FlowJson<Types> = {
    version: 1,
    nodes: [
        {
            id: "count",
            type: "block",
            position: { x: 0, y: 0 },
            data: { label: "Count", inputs: [], outputs: ["number"] },
        },
        {
            id: "name",
            type: "block",
            position: { x: 0, y: 160 },
            data: { label: "Name", inputs: [], outputs: ["text"] },
        },
        {
            id: "format",
            type: "block",
            position: { x: 260, y: 60 },
            data: {
                label: "Format",
                inputs: ["number", "text"],
                outputs: ["text"],
            },
        },
        {
            id: "print",
            type: "block",
            position: { x: 520, y: 90 },
            data: { label: "Print", inputs: ["text"], outputs: ["text"] },
        },
    ],
    edges: [
        {
            id: "count-format",
            source: "count",
            target: "format",
            sourceHandle: "number-0",
            targetHandle: "number-0",
        },
    ],
};

/** Where the i-th of `count` ports sits on its side. */
const portTop = (index: number, count: number) =>
    `${((index + 1) * 100) / (count + 1)}%`;

@Component({
    selector: "example-connection-validation",
    imports: [FLOW, Outcome],
    host: { class: "contents" },
    template: `
        <div flowRoot [model]="model" [fitView]="{ padding: 0.2, maxZoom: 1 }" [class]="styles.root">
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
                            <span [class]="styles.title">{{ node.data.label }}</span>
                            @for (port of node.data.inputs; track port + "-" + $index) {
                                <div
                                    flowHandle
                                    type="target"
                                    side="left"
                                    [handleId]="port + '-' + $index"
                                    [title]="port + ' input'"
                                    [class]="styles.port(port)"
                                    [style.top]="portTop($index, $count)"
                                ></div>
                            }
                            @for (port of node.data.outputs; track port + "-" + $index) {
                                <div
                                    flowHandle
                                    type="source"
                                    side="right"
                                    [handleId]="port + '-' + $index"
                                    [title]="port + ' output'"
                                    [class]="styles.port(port)"
                                    [style.top]="portTop($index, $count)"
                                ></div>
                            }
                        </div>
                    </ng-template>
                </div>
                <svg flowConnectionLine [class]="styles.connection"></svg>
            </div>
            <example-connection-validation-outcome />
        </div>
    `,
})
export default class ConnectionValidation {
    protected readonly styles = styles;
    protected readonly portTop = portTop;
    // the model is made once, with its middleware, and handed to the root
    protected readonly model = createFlowModel<Types, typeof features>(json, {
        features,
    });

    constructor() {
        this.model.use(connectionRules);
    }
}
