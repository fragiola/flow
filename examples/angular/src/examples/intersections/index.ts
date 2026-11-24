import { Component, signal } from "@angular/core";
import {
    createFlowModel,
    createFlowRef,
    FLOW,
    type FlowEngineEventOf,
    type FlowJson,
    type FlowTypes,
} from "@fragiola/flow-angular";
import { drag } from "@fragiola/flow-angular/drag";
import { keyboard } from "@fragiola/flow-angular/keyboard";
import { selection } from "@fragiola/flow-angular/selection";
import { type Placed, resolveCollisions } from "./collisions";
import { LinkEdge } from "./link-edge";
import { StepNode } from "./step-node";
import { styles } from "./styles";

// While nodes are dragged, what they run into is marked `data-intersecting`: the nodes they
// overlap (`engine.get("intersecting-nodes", { nodeId })`, the engine's own test) and the edges
// whose path crosses them (`edge-path-by`'s path against the dragged node's `node-rect-by`, in
// `crossing.ts`). Each node and edge reads it from a store (`injectFlowStore`, step-node.ts and
// link-edge.ts) over the nodes being dragged (`dragging-node-ids`), so the marks follow the drag
// and clear on the drop.
//
// "Resolve collisions" is app policy over the drop (`nodes-move`, `(nodesMove)`): the dropped
// nodes stay, and the nodes they overlap are pushed away until none does (`collisions.ts`), every
// move in one `batch`: one step, one undo.

export interface Types extends FlowTypes {
    readonly nodes: { step: { label: string } };
}

export const features = [selection(), drag(), keyboard()] as const;

/** The empty space (flow units) the resolver keeps between two nodes. */
const MARGIN = 16;

const step = (id: string, label: string, x: number, y: number) => ({
    id,
    type: "step" as const,
    position: { x, y },
    width: 140,
    height: 56,
    data: { label },
});

const link = (source: string, target: string) => ({
    id: `${source}-${target}`,
    source,
    target,
});

const json: FlowJson<Types> = {
    version: 1,
    nodes: [
        step("fetch", "Fetch", 0, 0),
        step("store", "Store", 520, 0),
        step("parse", "Parse", 260, 160),
        step("index", "Index", 520, 160),
        step("notify", "Notify", 0, 320),
        step("log", "Log", 260, 320),
    ],
    edges: [
        link("fetch", "store"),
        link("parse", "index"),
        link("notify", "log"),
    ],
};

/** The node's labels, for the edges' names. */
const LABELS: Record<string, string> = Object.fromEntries(
    json.nodes.map((node) => [node.id, node.data.label]),
);

export const labelOf = (id: string) => LABELS[id] ?? id;

@Component({
    selector: "example-intersections",
    imports: [FLOW, LinkEdge, StepNode],
    host: { class: "contents" },
    template: `
        <div
            flowRoot
            [model]="model"
            [fitView]="{ padding: 0.2, maxZoom: 1 }"
            [flowRef]="flow"
            (nodesMove)="onNodesMove($event)"
            role="group"
            aria-label="Intersections"
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
                            exampleLinkEdge
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
                            exampleStepNode
                            role="group"
                            aria-roledescription="node"
                            [attr.aria-label]="node.data.label"
                            [class]="styles.node"
                        ></div>
                    </ng-template>
                </div>
            </div>
            <label data-flow-no-gesture [class]="styles.option">
                <input
                    type="checkbox"
                    role="switch"
                    [checked]="resolve()"
                    [attr.aria-checked]="resolve()"
                    (change)="toggleResolve($event)"
                    [class]="styles.switch"
                />
                Resolve collisions
            </label>
            <p [class]="styles.hint">Drag a node over another one or across an edge</p>
        </div>
    `,
})
export default class Intersections {
    protected readonly styles = styles;
    protected readonly model = createFlowModel<Types, typeof features>(json, {
        features,
    });
    protected readonly flow = createFlowRef<Types, typeof features>();
    protected readonly resolve = signal(false);

    protected label(id: string): string {
        return labelOf(id);
    }

    protected toggleResolve(event: Event): void {
        this.resolve.set((event.target as HTMLInputElement).checked);
    }

    /** A drop with "Resolve collisions" on: the dropped nodes stay, the others make room. */
    protected onNodesMove(event: FlowEngineEventOf<"nodes-move">): void {
        const current = this.flow.current;
        if (!this.resolve() || !current || event.source !== "pointer") return;
        const placed: Placed[] = [];
        for (const node of current.model.get("all-nodes")) {
            const box = current.engine.get("node-rect-by", { nodeId: node.id });
            if (box && box.width > 0) placed.push({ id: node.id, box });
        }
        const moved = resolveCollisions(placed, {
            fixed: event.nodeIds,
            margin: MARGIN,
        });
        if (moved.length === 0) return;
        current.model.run("batch", {
            commands: moved.map(({ id, position }) => ({
                command: "node.move" as const,
                payload: { nodeId: id, position },
            })),
        });
    }
}
