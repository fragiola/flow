import { Component, signal } from "@angular/core";
import {
    createFlowModel,
    FLOW,
    type FlowModel,
    type FlowNodeInput,
    type FlowTypes,
} from "@fragiola/flow-angular";
import { drag } from "@fragiola/flow-angular/drag";
import { selection } from "@fragiola/flow-angular/selection";
import { styles } from "./styles";

// `drag({ snapGrid })` moves a dragged node onto the grid: its top-left corner lands on a multiple
// of the grid (the other dragged nodes keep their offsets). The background draws the same grid
// (`gap`). A feature's options are fixed when the model is made, so another grid size makes a new
// model and remounts the root, starting from the nodes as they are now.

interface Types extends FlowTypes {
    readonly nodes: { card: { label: string } };
}

const SIZES = [10, 20, 40];

const featuresFor = (grid: number) =>
    [selection(), drag({ snapGrid: [grid, grid] })] as const;

type Features = ReturnType<typeof featuresFor>;

const initial: FlowNodeInput<Types>[] = [
    {
        id: "a",
        type: "card",
        position: { x: 0, y: 0 },
        data: { label: "Snaps" },
    },
    {
        id: "b",
        type: "card",
        position: { x: 200, y: 80 },
        data: { label: "to the" },
    },
    {
        id: "c",
        type: "card",
        position: { x: 80, y: 200 },
        data: { label: "grid" },
    },
];

/** A flow snapping to `grid`, from `nodes`. */
interface Snapping {
    grid: number;
    model: FlowModel<Types, Features>;
}

function snapping(
    grid: number,
    nodes: readonly FlowNodeInput<Types>[],
): Snapping {
    const features = featuresFor(grid);
    return {
        grid,
        model: createFlowModel<Types, Features>(
            { version: 1, nodes: [...nodes], edges: [] },
            { features },
        ),
    };
}

@Component({
    selector: "example-snap-to-grid",
    imports: [FLOW],
    host: { class: "contents" },
    template: `
        <div [class]="styles.layout">
            <fieldset [class]="styles.toolbar">
                <legend [class]="styles.legend">Grid size</legend>
                @for (size of sizes; track size) {
                    <button
                        type="button"
                        [attr.aria-pressed]="flow()[0]?.grid === size"
                        [class]="styles.segment"
                        (click)="choose(size)"
                    >
                        {{ size }} px
                    </button>
                }
            </fieldset>
            <!-- one flow, keyed by its model: another grid size remounts the root -->
            @for (current of flow(); track current.model) {
                <div flowRoot [model]="current.model" [fitView]="{ padding: 0.2, maxZoom: 1 }" [class]="styles.root">
                    <svg flowBackground variant="dots" [gap]="current.grid" [size]="2" [class]="styles.dots"></svg>
                    <svg flowBackground variant="lines" [gap]="current.grid" [class]="styles.lines"></svg>
                    <svg flowBackground variant="cross" [gap]="current.grid" [class]="styles.cross"></svg>
                    <div flowViewport>
                        <div flowNodes>
                            <ng-template [flowNodesItem]="current.model" let-node>
                                <div [flowNode]="node" [class]="styles.node">
                                    {{ node.data.label }}
                                    <span data-testid="position" [class]="styles.position">{{ node.position.x }}, {{ node.position.y }}</span>
                                </div>
                            </ng-template>
                        </div>
                    </div>
                </div>
            }
        </div>
    `,
})
export default class SnapToGrid {
    protected readonly styles = styles;
    protected readonly sizes = SIZES;
    protected readonly flow = signal<readonly Snapping[]>([
        snapping(20, initial),
    ]);

    protected choose(grid: number): void {
        const current = this.flow()[0];
        if (current?.grid === grid) return;
        // the nodes as they are now, for the next model
        const nodes = current?.model.get("all-nodes") ?? initial;
        this.flow.set([snapping(grid, nodes)]);
    }
}
