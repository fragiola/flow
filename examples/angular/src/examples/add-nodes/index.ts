import { Component } from "@angular/core";
import {
    createFlowModel,
    createFlowRef,
    FLOW,
    type FlowEngineEventOf,
    type FlowNodeInput,
    type FlowTypes,
} from "@fragiola/flow-angular";
import { connection } from "@fragiola/flow-angular/connection";
import { drag } from "@fragiola/flow-angular/drag";
import { selection } from "@fragiola/flow-angular/selection";
import {
    LucideCircle,
    LucideDiamond,
    LucideDynamicIcon,
    LucideSquare,
} from "@lucide/angular";
import { styles } from "./styles";

// Adding nodes from outside the flow. The palette's items are dragged with the browser's own drag
// and drop: the root accepts the drop, and `engine.get("screen-to-flow", { x, y })` turns the
// drop's client point into flow coordinates, where `node.add` puts the node. A click on an item
// adds one at the centre of the view instead. `createFlowRef` reaches the model and the engine
// from outside the root. A connection dropped on the canvas adds a task there, joined to where it
// came from: `(connectCancel)` tells where it ended (`point`, in flow coordinates) and from which
// handle (`from`), and `to` is empty when it ended over no handle.

const SHAPES = [
    { shape: "circle", label: "Start", icon: LucideCircle },
    { shape: "square", label: "Task", icon: LucideSquare },
    { shape: "diamond", label: "Decision", icon: LucideDiamond },
] as const;

type Shape = (typeof SHAPES)[number]["shape"];

interface Types extends FlowTypes {
    readonly nodes: { shape: { shape: Shape; label: string } };
}

const features = [selection(), drag(), connection()] as const;

const MIME = "application/x-flow-shape";

const nodes: FlowNodeInput<Types>[] = [
    {
        id: "first",
        type: "shape",
        position: { x: 0, y: 0 },
        data: { shape: "circle", label: "Start" },
    },
];

let count = 0;

@Component({
    selector: "example-add-nodes",
    imports: [FLOW, LucideDynamicIcon],
    host: { class: "contents" },
    template: `
        <div data-testid="add-nodes" [class]="styles.layout">
            <aside aria-label="Node palette" [class]="styles.palette">
                <p [class]="styles.paletteTitle">Drag or click</p>
                @for (item of shapes; track item.shape) {
                    <button
                        type="button"
                        draggable="true"
                        [class]="styles.item"
                        (dragstart)="onDragStart($event, item.shape)"
                        (click)="addAtCentre(item.shape, $event)"
                    >
                        <svg [lucideIcon]="item.icon" aria-hidden="true"></svg>
                        {{ item.label }}
                    </button>
                }
            </aside>
            <div
                flowRoot
                [model]="model"
                [defaultViewport]="{ x: 160, y: 80, zoom: 1 }"
                [flowRef]="flow"
                [class]="styles.root"
                (connectCancel)="onConnectCancel($event)"
                (dragover)="onDragOver($event)"
                (drop)="onDrop($event)"
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
                            <div [flowNode]="node" [class]="styles.shape(node.data.shape)">
                                {{ node.data.label }}
                                <div flowHandle type="target" side="top" [class]="styles.handle"></div>
                                <div flowHandle type="source" side="bottom" [class]="styles.handle"></div>
                            </div>
                        </ng-template>
                    </div>
                    <svg flowConnectionLine [class]="styles.connection"></svg>
                </div>
            </div>
        </div>
    `,
})
export default class AddNodes {
    protected readonly styles = styles;
    protected readonly shapes = SHAPES;
    protected readonly model = createFlowModel<Types, typeof features>(
        { version: 1, nodes, edges: [] },
        { features },
    );
    protected readonly flow = createFlowRef<Types, typeof features>();

    /** Adds a node centred on a client point (a drop's, or the view's centre). */
    private addAt(shape: Shape, client: { x: number; y: number }): void {
        const current = this.flow.current;
        if (!current) return;
        const point = current.engine.get("screen-to-flow", client);
        const label =
            SHAPES.find((item) => item.shape === shape)?.label ?? shape;
        count += 1;
        current.model.run("node.add", {
            id: `${shape}-${count}`,
            type: "shape",
            // the node's top-left corner, so that its middle lands on the point
            position: { x: point.x - 50, y: point.y - 20 },
            data: { shape, label: `${label} ${count}` },
        });
    }

    protected addAtCentre(shape: Shape, event: MouseEvent): void {
        const button = event.currentTarget as HTMLElement;
        const root = button
            .closest("[data-testid=add-nodes]")
            ?.querySelector('[data-flow-part="root"]');
        const box = root?.getBoundingClientRect();
        if (box)
            this.addAt(shape, {
                x: box.x + box.width / 2,
                y: box.y + box.height / 2,
            });
    }

    protected onDragStart(event: DragEvent, shape: Shape): void {
        if (!event.dataTransfer) return;
        event.dataTransfer.setData(MIME, shape);
        event.dataTransfer.effectAllowed = "copy";
    }

    protected onDragOver(event: DragEvent): void {
        if (!event.dataTransfer?.types.includes(MIME)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
    }

    /** A connection dropped over no handle: a new task there, joined to its start. */
    protected onConnectCancel(
        event: FlowEngineEventOf<"connect-cancel">,
    ): void {
        const model = this.flow.current?.model;
        if (!model || !event.dropped || event.to || event.input !== "pointer")
            return;
        count += 1;
        const nodeId = `square-${count}`;
        model.run("batch", {
            commands: [
                {
                    command: "node.add",
                    payload: {
                        id: nodeId,
                        type: "shape",
                        position: { x: event.point.x - 50, y: event.point.y },
                        data: { shape: "square", label: `Task ${count}` },
                    },
                },
                {
                    command: "edge.add",
                    payload:
                        event.from.type === "source"
                            ? { source: event.from.nodeId, target: nodeId }
                            : { source: nodeId, target: event.from.nodeId },
                },
            ],
        });
    }

    protected onDrop(event: DragEvent): void {
        const shape = event.dataTransfer?.getData(MIME) as Shape;
        if (!SHAPES.some((item) => item.shape === shape)) return;
        event.preventDefault();
        this.addAt(shape, { x: event.clientX, y: event.clientY });
    }
}
