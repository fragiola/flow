import { Component, DestroyRef, inject, signal } from "@angular/core";
import {
    createFlowModel,
    FLOW,
    type FlowModel,
    type FlowTypes,
    type Viewport,
} from "@fragiola/flow-angular";
import { drag } from "@fragiola/flow-angular/drag";
import { selection } from "@fragiola/flow-angular/selection";
import { LucideShuffle } from "@lucide/angular";
import { generateFlow, labelOf, SIZES, type Size, shuffle } from "./generate";
import { Readout } from "./readout";
import { styles } from "./styles";

// A flow of thousands of nodes and as many edges, generated (generate.ts: a seeded grid joined into
// one tree, the same every time), 1,000 by default and up to 20,000. `onlyRenderVisible` keeps in
// the DOM only the nodes and edges in view, so the DOM stays small whatever the size; the readout
// shows what each gesture costs. The nodes declare their size and handles, so a node never drawn
// still has a box (it is culled rightly) and its edges have ends. Until the root has a size (the
// view known), a culled flow renders no node, so no more than the visible ones ever mount.
// "Shuffle" moves every node in one `batch`: one change, one render. The readout counts the nodes
// and edges in the DOM and times the frames (requestAnimationFrame, the median of the last 60,
// frames.ts), the last size switch and the last shuffle (until the next frame). The readout
// (readout.ts) is a component of its own, so its reads a few times a second check it alone, not
// every node's view.

export interface Types extends FlowTypes {
    readonly nodes: { cell: { label: string } };
}

const features = [selection(), drag()] as const;

/** How the size picker names a size: "10,000 nodes". */
const sizeName = (size: number) => `${size.toLocaleString("en-US")} nodes`;

/** A node's place as it prints it, for the tests: "x, y", rounded. */
const placeOf = (position: { readonly x: number; readonly y: number }) =>
    `${Math.round(position.x)}, ${Math.round(position.y)}`;

/** The flow of one size: a new size is a new model, and a new root. */
interface Sized {
    readonly size: Size;
    readonly edges: number;
    readonly model: FlowModel<Types, typeof features>;
}

function sized(size: Size): Sized {
    const { nodes, edges } = generateFlow(size);
    return {
        size,
        edges: edges.length,
        model: createFlowModel<Types, typeof features>(
            { version: 1, nodes, edges },
            { features },
        ),
    };
}

const viewport: Viewport = { x: 48, y: 120, zoom: 1 };

@Component({
    selector: "example-stress-test",
    imports: [FLOW, LucideShuffle, Readout],
    host: { class: "contents" },
    template: `
        <div #frame [class]="styles.frame">
            <!-- one flow, keyed by its model: a new size is a new flow -->
            @for (current of flow(); track current.model) {
                <div
                    flowRoot
                    [model]="current.model"
                    [defaultViewport]="viewport"
                    [minZoom]="0.1"
                    onlyRenderVisible
                    (init)="onInit()"
                    role="group"
                    aria-label="Stress test"
                    [attr.aria-busy]="renderMs() === undefined"
                    [class]="styles.root"
                >
                    <svg flowBackground variant="dots" [size]="2" [class]="styles.dots"></svg>
                    <svg flowBackground variant="lines" [class]="styles.lines"></svg>
                    <svg flowBackground variant="cross" [class]="styles.cross"></svg>
                    <div flowViewport>
                        <div flowEdges>
                            <ng-template [flowEdgesItem]="current.model" let-edge>
                                <svg:g
                                    [flowEdge]="edge"
                                    role="group"
                                    aria-roledescription="edge"
                                    [attr.aria-label]="labelOf(edge.source) + ' to ' + labelOf(edge.target)"
                                    [class]="styles.edgeGroup"
                                >
                                    <svg:path flowEdgePath [class]="styles.edge" />
                                </svg:g>
                            </ng-template>
                        </div>
                        <div flowNodes>
                            <ng-template [flowNodesItem]="current.model" let-node>
                                <!-- a cheap node: one element and its label, its place on it for the tests -->
                                <div
                                    [flowNode]="node"
                                    role="group"
                                    aria-roledescription="node"
                                    [attr.aria-label]="node.data.label"
                                    [attr.data-position]="placeOf(node.position)"
                                    [class]="styles.node"
                                >
                                    {{ node.data.label }}
                                </div>
                            </ng-template>
                        </div>
                    </div>
                </div>
            }
            <div data-flow-no-gesture="" [class]="styles.panel">
                <label [class]="styles.field">
                    <span>Size</span>
                    <select #picker [class]="styles.select" (change)="onSize(picker.value)">
                        @for (option of sizes; track option) {
                            <option [value]="option" [selected]="option === size()">{{ sizeName(option) }}</option>
                        }
                    </select>
                </label>
                <button type="button" [class]="styles.button" (click)="onShuffle()">
                    <svg lucideShuffle aria-hidden="true"></svg>
                    Shuffle
                </button>
                <dl
                    exampleReadout
                    aria-label="Readout"
                    data-testid="readout"
                    [frame]="frame"
                    [size]="size()"
                    [edges]="flow()[0]?.edges ?? 0"
                    [renderMs]="renderMs()"
                    [shuffleMs]="shuffleMs()"
                    [class]="styles.readout"
                ></dl>
            </div>
        </div>
    `,
})
export default class StressTest {
    protected readonly styles = styles;
    protected readonly sizes = SIZES;
    protected readonly sizeName = sizeName;
    protected readonly placeOf = placeOf;
    protected readonly labelOf = labelOf;
    protected readonly viewport = viewport;
    protected readonly flow = signal<readonly Sized[]>([sized(SIZES[0])]);
    protected readonly size = signal<Size>(SIZES[0]);
    // when the shown size was asked for: the first render, then each switch
    private switchedAt = performance.now();
    protected readonly renderMs = signal<number | undefined>(undefined);
    protected readonly shuffleMs = signal<number | undefined>(undefined);
    private shuffles = 0;
    private readonly frames = new Set<number>();

    constructor() {
        inject(DestroyRef).onDestroy(() => {
            for (const id of this.frames) cancelAnimationFrame(id);
            this.frames.clear();
        });
    }

    /** Calls `done` with the time since `start` once the next frame begins (the change is drawn). */
    private timeToFrame(start: number, done: (ms: number) => void): void {
        const id = requestAnimationFrame(() => {
            this.frames.delete(id);
            done(performance.now() - start);
        });
        this.frames.add(id);
    }

    protected onInit(): void {
        this.timeToFrame(this.switchedAt, (ms) => this.renderMs.set(ms));
    }

    protected onSize(value: string): void {
        const next = SIZES.find((option) => String(option) === value);
        if (next === undefined || next === this.size()) return;
        this.switchedAt = performance.now();
        this.renderMs.set(undefined);
        this.shuffleMs.set(undefined);
        this.size.set(next);
        this.flow.set([sized(next)]);
    }

    protected onShuffle(): void {
        const model = this.flow()[0]?.model;
        if (!model) return;
        this.shuffles += 1;
        const start = performance.now();
        const moves = shuffle(model.get("all-nodes"), this.shuffles + 1);
        // every move in one batch: one change of the document, one render
        model.run("batch", {
            commands: moves.map((payload) => ({
                command: "node.move" as const,
                payload,
            })),
        });
        this.timeToFrame(start, (ms) => this.shuffleMs.set(ms));
    }
}
