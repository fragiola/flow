import { Component, DestroyRef, DOCUMENT, inject, signal } from "@angular/core";
import {
    createFlowModel,
    FLOW,
    type FlowEdgeInput,
    type FlowNodeInput,
    type FlowTypes,
} from "@fragiola/flow-angular";
import { connection } from "@fragiola/flow-angular/connection";
import { drag } from "@fragiola/flow-angular/drag";
import { keyboard } from "@fragiola/flow-angular/keyboard";
import { selection } from "@fragiola/flow-angular/selection";
import { LucideRedo2, LucideUndo2 } from "@lucide/angular";
import { createUndoHistory, handleUndoKeys } from "../_kit/undo";
import { styles } from "./styles";

// Undo is app policy: `_kit/undo.ts` (copy it) listens to the model and keeps the documents before
// each step. A drag is one step (its transient moves end with a final one), and so is a connection
// or a deletion (Delete removes the selection with its edges, in one command). Selecting is not a
// step. Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z redoes.

interface Types extends FlowTypes {
    readonly nodes: { block: { label: string } };
}

const features = [selection(), drag(), connection(), keyboard()] as const;

const nodes: FlowNodeInput<Types>[] = [
    {
        id: "a",
        type: "block",
        position: { x: 0, y: 0 },
        data: { label: "Drag" },
    },
    {
        id: "b",
        type: "block",
        position: { x: 220, y: 0 },
        data: { label: "Connect" },
    },
    {
        id: "c",
        type: "block",
        position: { x: 110, y: 140 },
        data: { label: "Delete" },
    },
];

const edges: FlowEdgeInput<Types>[] = [{ id: "a-c", source: "a", target: "c" }];

@Component({
    selector: "example-undo-redo",
    imports: [FLOW, LucideUndo2, LucideRedo2],
    // the shortcuts, on the window: a Delete leaves the focus on the page, not in the flow (an app
    // with other editable content would scope them to its editor)
    host: { class: "contents" },
    template: `
        <div flowRoot [model]="model" [fitView]="{ padding: 0.2, maxZoom: 1 }" [class]="styles.root">
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
                            [attr.aria-label]="edge.source + ' to ' + edge.target"
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
                            [class]="styles.node"
                        >
                            {{ node.data.label }}
                            <div flowHandle type="target" side="top" [class]="styles.handle"></div>
                            <div flowHandle type="source" side="bottom" [class]="styles.handle"></div>
                        </div>
                    </ng-template>
                </div>
                <svg flowConnectionLine [class]="styles.connection"></svg>
            </div>
            <div [class]="styles.panel">
                <div role="toolbar" aria-label="History" [class]="styles.buttons">
                    <button
                        type="button"
                        aria-label="Undo"
                        [disabled]="!snapshot().canUndo"
                        [class]="styles.button"
                        (click)="history.undo()"
                    >
                        <svg lucideUndo2 aria-hidden="true"></svg>
                    </button>
                    <button
                        type="button"
                        aria-label="Redo"
                        [disabled]="!snapshot().canRedo"
                        [class]="styles.button"
                        (click)="history.redo()"
                    >
                        <svg lucideRedo2 aria-hidden="true"></svg>
                    </button>
                </div>
                <ol aria-label="Steps" data-testid="steps" [class]="styles.steps">
                    <!-- the steps are a stack -->
                    @for (step of snapshot().undoSteps; track $index) {
                        <li [class]="styles.step">{{ step }}</li>
                    }
                </ol>
            </div>
        </div>
    `,
})
export default class UndoRedo {
    protected readonly styles = styles;
    // the model is made here, so that the history and the shortcuts sit beside the root
    protected readonly model = createFlowModel<Types, typeof features>(
        { version: 1, nodes, edges },
        { features },
    );
    protected readonly history = createUndoHistory(this.model);
    protected readonly snapshot = signal(this.history.getSnapshot());

    constructor() {
        const stop = this.history.subscribe(() =>
            this.snapshot.set(this.history.getSnapshot()),
        );
        // the shortcuts, page-wide: a plain listener, not a host binding, which would check the
        // whole template (every node) on every key press, an arrow's move included
        const window = inject(DOCUMENT).defaultView;
        const onKeyDown = (event: KeyboardEvent) =>
            handleUndoKeys(this.history, event);
        window?.addEventListener("keydown", onKeyDown);
        inject(DestroyRef).onDestroy(() => {
            window?.removeEventListener("keydown", onKeyDown);
            stop();
            this.history.dispose();
        });
    }
}
