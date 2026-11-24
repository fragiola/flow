import {
    Component,
    DestroyRef,
    effect,
    inject,
    signal,
    untracked,
} from "@angular/core";
import {
    createFlowModel,
    createFlowRef,
    FLOW,
    type FlowEdgeInput,
    type FlowEngine,
    type FlowModel,
    type FlowNode,
    type FlowNodeInput,
    type FlowTypes,
} from "@fragiola/flow-angular";
import { drag } from "@fragiola/flow-angular/drag";
import { selection } from "@fragiola/flow-angular/selection";
import {
    ALGORITHMS,
    type Algorithm,
    type LayoutNode,
    layoutGraph,
    type Placement,
} from "./layout";
import { styles } from "./styles";

// A data pipeline laid out by ELK (`layout.ts`): its nodes declare their size and have several
// named inputs (left) and outputs (right), each edge joins two of them. Each handle is an ELK port
// on its side, and ELK may reorder the ports of a side to uncross the edges. The document opens
// in a naive order (the edges cross); once the root is rendered (the flow ref holds its model and
// engine, an `effect`), ELK lays it out (async): in ONE `batch`, each node's `node.set-data` takes
// the handle order ELK chose (the handles are tracked by their side's order, so they remount and
// the engine measures them again) and `node.move` its place; then `fit-view` animated.
// "Algorithm" lays it out again, "Layered" or "Tree" (`mrtree`); a request id keeps a layout that
// resolves after a newer one was asked for, or after leaving (`DestroyRef`), from applying. The
// root carries `data-algorithm` and `data-layout="running" | "done"`.

export interface Types extends FlowTypes {
    readonly nodes: {
        stage: { label: string; inputs: string[]; outputs: string[] };
    };
}

export const features = [selection(), drag()] as const;

/** Every node's width, and the rows its height is made of, in flow units (`styles.ts`). */
const WIDTH = 170;
const TITLE = 28;
const ROW = 20;
const PADDING = 8;

/** How the view fits the pipeline: some room around it, never zoomed in past 1. */
const FIT = { padding: 0.15, maxZoom: 1 };

const FIRST: Algorithm = "layered";

type Stage = readonly [
    id: string,
    label: string,
    inputs: readonly string[],
    outputs: readonly string[],
];

/**
 * The pipeline: three sources joined, sessionized and enriched into a warehouse, with a quality
 * report of what failed. The handles are listed in an order that crosses the edges (Join's
 * "customers" above "orders", whose source is above), for ELK to put right.
 */
const STAGES: readonly Stage[] = [
    ["quality", "Quality report", ["errors", "unmatched"], []],
    ["orders", "Orders API", [], ["records"]],
    ["enrich", "Enrich", ["sessions", "matched"], ["errors", "profiles"]],
    ["customers", "Customers DB", [], ["rows"]],
    ["join", "Join", ["customers", "orders"], ["unmatched", "matched"]],
    ["dashboard", "Dashboard", ["tables"], []],
    ["clicks", "Clickstream", [], ["events"]],
    ["warehouse", "Warehouse", ["bounces", "profiles"], ["tables"]],
    ["sessions", "Sessionize", ["events"], ["bounces", "sessions"]],
];

/** Each edge: source node and output, target node and input. */
const LINKS: readonly (readonly [
    source: string,
    output: string,
    target: string,
    input: string,
])[] = [
    ["orders", "records", "join", "orders"],
    ["customers", "rows", "join", "customers"],
    ["clicks", "events", "sessions", "events"],
    ["join", "matched", "enrich", "matched"],
    ["join", "unmatched", "quality", "unmatched"],
    ["sessions", "sessions", "enrich", "sessions"],
    ["sessions", "bounces", "warehouse", "bounces"],
    ["enrich", "profiles", "warehouse", "profiles"],
    ["enrich", "errors", "quality", "errors"],
    ["warehouse", "tables", "dashboard", "tables"],
];

const LABELS: Record<string, string> = Object.fromEntries(
    STAGES.map(([id, label]) => [id, label]),
);

const labelOf = (id: string) => LABELS[id] ?? id;

const heightOf = (inputs: number, outputs: number) =>
    TITLE + ROW * Math.max(1, inputs, outputs) + PADDING;

// a naive placement: a grid in the list's order, where the edges cross; ELK replaces it on open
const nodes: FlowNodeInput<Types>[] = STAGES.map(
    ([id, label, inputs, outputs], index) => ({
        id,
        type: "stage",
        position: { x: (index % 3) * 240, y: Math.floor(index / 3) * 130 },
        width: WIDTH,
        height: heightOf(inputs.length, outputs.length),
        data: { label, inputs: [...inputs], outputs: [...outputs] },
    }),
);

const edges: FlowEdgeInput<Types>[] = LINKS.map(
    ([source, output, target, input]) => ({
        id: `${source}-${target}`,
        source,
        target,
        sourceHandle: output,
        targetHandle: input,
    }),
);

const ALGORITHM_NAMES: Record<Algorithm, string> = {
    layered: "Layered",
    mrtree: "Tree",
};

/** What the layout reads of a node: its id, declared size and handles. */
const layoutNodeOf = (node: FlowNode<Types>): LayoutNode => ({
    id: node.id,
    width: node.width ?? WIDTH,
    height:
        node.height ??
        heightOf(node.data.inputs.length, node.data.outputs.length),
    inputs: node.data.inputs,
    outputs: node.data.outputs,
});

/** Lays the flow's document out with ELK: every node's place and handle order. */
function layout(
    model: FlowModel<Types, typeof features>,
    algorithm: Algorithm,
) {
    return layoutGraph(
        model.get("all-nodes").map(layoutNodeOf),
        model.get("all-edges"),
        algorithm,
    );
}

/**
 * Applies ELK's result as ONE change: each node's handle order and its place, in one `batch`
 * (one step for a history or a save); then fits the view to it, animated, once the engine can.
 */
function apply(
    model: FlowModel<Types, typeof features>,
    engine: FlowEngine<Types, typeof features>,
    placements: ReadonlyMap<string, Placement>,
) {
    model.run("batch", {
        commands: [...placements].flatMap(([nodeId, placement]) => [
            {
                command: "node.set-data" as const,
                payload: {
                    nodeId,
                    data: {
                        inputs: [...placement.inputs],
                        outputs: [...placement.outputs],
                    },
                },
            },
            {
                command: "node.move" as const,
                payload: { nodeId, position: placement.position },
            },
        ]),
    });
    // before `ready` the root's own `fitView` fits the laid-out nodes once they are measured
    if (engine.is("ready")) engine.run("fit-view", { ...FIT, duration: 300 });
}

/** A node's place as it prints it, for the tests: "x, y", rounded. */
const placeOf = (node: FlowNode<Types>) =>
    `${Math.round(node.position.x)}, ${Math.round(node.position.y)}`;

/**
 * A side's handles, each with its track: the side's order and its id, so a new order remounts the
 * side's handles and the engine measures their new centres (it does so when a handle registers).
 * A track expression reads only its item, so the order goes into the item.
 */
const rowsOf = (side: readonly string[]) => {
    const order = side.join(",");
    return side.map((handleId) => ({
        handleId,
        track: `${order}/${handleId}`,
    }));
};

@Component({
    selector: "example-elk-layout",
    imports: [FLOW],
    host: { class: "contents" },
    template: `
        <div
            flowRoot
            [model]="model"
            [fitView]="fit"
            [flowRef]="flow"
            role="group"
            aria-label="ELK layout"
            [attr.data-algorithm]="algorithm()"
            [attr.data-layout]="running() ? 'running' : 'done'"
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
                            [attr.data-position]="placeOf(node)"
                            [class]="styles.node"
                        >
                            <span [class]="styles.title">{{ node.data.label }}</span>
                            <span [class]="styles.ports">
                                <span [class]="styles.column">
                                    @for (input of rowsOf(node.data.inputs); track input.track) {
                                        <span [class]="styles.inputRow">
                                            <div
                                                flowHandle
                                                type="target"
                                                side="left"
                                                [handleId]="input.handleId"
                                                [class]="styles.handle"
                                            ></div>
                                            {{ input.handleId }}
                                        </span>
                                    }
                                </span>
                                <span [class]="styles.column">
                                    @for (output of rowsOf(node.data.outputs); track output.track) {
                                        <span [class]="styles.outputRow">
                                            {{ output.handleId }}
                                            <div
                                                flowHandle
                                                type="source"
                                                side="right"
                                                [handleId]="output.handleId"
                                                [class]="styles.handle"
                                            ></div>
                                        </span>
                                    }
                                </span>
                            </span>
                        </div>
                    </ng-template>
                </div>
            </div>
            <fieldset [class]="styles.panel">
                <legend [class]="styles.legend">Algorithm</legend>
                @for (option of algorithms; track option) {
                    <label [class]="styles.option">
                        <input
                            type="radio"
                            name="elk-algorithm"
                            [value]="option"
                            [checked]="algorithm() === option"
                            (change)="arrange(option)"
                            [class]="styles.radio"
                        />
                        {{ names[option] }}
                    </label>
                }
            </fieldset>
        </div>
    `,
})
export default class ElkLayout {
    protected readonly styles = styles;
    protected readonly fit = FIT;
    protected readonly algorithms = ALGORITHMS;
    protected readonly names = ALGORITHM_NAMES;
    protected readonly placeOf = placeOf;
    protected readonly rowsOf = rowsOf;
    protected readonly model = createFlowModel<Types, typeof features>(
        { version: 1, nodes, edges },
        { features },
    );
    protected readonly flow = createFlowRef<Types, typeof features>();
    protected readonly algorithm = signal<Algorithm>(FIRST);
    protected readonly running = signal(true);
    /** the latest layout asked for: an older one that resolves later is dropped */
    private request = 0;
    /** whether the first layout was asked for */
    private started = false;

    constructor() {
        // the first layout, once the root is rendered (the flow ref holds its model and engine)
        effect(() => {
            if (this.started || !this.flow.current) return;
            this.started = true;
            untracked(() => this.arrange(FIRST));
        });
        // leaving drops a pending layout
        inject(DestroyRef).onDestroy(() => {
            this.request += 1;
        });
    }

    protected label(id: string): string {
        return labelOf(id);
    }

    protected arrange(next: Algorithm): void {
        const current = this.flow.current;
        if (!current) return;
        const { model, engine } = current;
        this.request += 1;
        const id = this.request;
        this.algorithm.set(next);
        this.running.set(true);
        void layout(model, next)
            .then((placements) => {
                if (id !== this.request) return;
                apply(model, engine, placements);
                this.running.set(false);
            })
            .catch((error: unknown) => {
                // a failed layout leaves the nodes where they are, and the controls usable again
                if (id !== this.request) return;
                console.error("The ELK layout failed", error);
                this.running.set(false);
            });
    }
}
