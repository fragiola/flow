import { Component, signal } from "@angular/core";
import {
    createFlowModel,
    createFlowRef,
    FLOW,
    type FlowDocumentJson,
    type FlowNodeInput,
    type FlowTypes,
    type Viewport,
    validateFlow,
} from "@fragiola/flow-angular";
import { connection } from "@fragiola/flow-angular/connection";
import { drag } from "@fragiola/flow-angular/drag";
import { selection } from "@fragiola/flow-angular/selection";
import { LucidePlus, LucideRotateCcw, LucideSave } from "@lucide/angular";
import { load, save } from "../_kit/persistence";
import { styles } from "./styles";

// The document is plain JSON: `model.get("flow-json")` is everything to save (nodes, edges, the
// selection), and the viewport is the engine's (`engine.get("viewport")`). Restoring brings the
// live model to the saved document with the commands a user would have run
// (`model.get("commands-to", …)`, one `batch`) and sets the viewport back. Nothing remounts.

interface Types extends FlowTypes {
    readonly nodes: { topic: { label: string } };
}

const features = [selection(), drag(), connection()] as const;

const KEY = "fragiola-flow-example:save-and-restore";

interface Saved {
    flow: FlowDocumentJson<Types>;
    viewport: Viewport;
}

const nodes: FlowNodeInput<Types>[] = [
    {
        id: "plan",
        type: "topic",
        position: { x: 0, y: 0 },
        data: { label: "Plan" },
    },
    {
        id: "write",
        type: "topic",
        position: { x: 200, y: 100 },
        data: { label: "Write" },
    },
];

/** A viewport read back from storage: three numbers. */
function isViewport(value: unknown): value is Viewport {
    const { x, y, zoom } = (value ?? {}) as Partial<Record<string, unknown>>;
    return [x, y, zoom].every(
        (n) => typeof n === "number" && Number.isFinite(n),
    );
}

@Component({
    selector: "example-save-and-restore",
    imports: [FLOW, LucidePlus, LucideSave, LucideRotateCcw],
    host: { class: "contents" },
    template: `
        <div
            flowRoot
            [model]="model"
            [defaultViewport]="{ x: 120, y: 120, zoom: 1 }"
            [flowRef]="flow"
            [class]="styles.root"
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
                        <div [flowNode]="node" [class]="styles.node">
                            {{ node.data.label }}
                            <div flowHandle type="target" side="top" [class]="styles.handle"></div>
                            <div flowHandle type="source" side="bottom" [class]="styles.handle"></div>
                        </div>
                    </ng-template>
                </div>
                <svg flowConnectionLine [class]="styles.connection"></svg>
            </div>
            <div role="toolbar" aria-label="Flow file" [class]="styles.panel">
                <button type="button" [class]="styles.button" (click)="onAdd()">
                    <svg lucidePlus aria-hidden="true"></svg>
                    Add a node
                </button>
                <button type="button" [class]="styles.primary" (click)="onSave()">
                    <svg lucideSave aria-hidden="true"></svg>
                    Save
                </button>
                <button type="button" [class]="styles.button" (click)="onRestore()">
                    <svg lucideRotateCcw aria-hidden="true"></svg>
                    Restore
                </button>
                <p role="status" data-testid="message" [class]="styles.message">{{ message() }}</p>
            </div>
        </div>
    `,
})
export default class SaveAndRestore {
    protected readonly styles = styles;
    protected readonly model = createFlowModel<Types, typeof features>(
        {
            version: 1,
            nodes,
            edges: [{ id: "plan-write", source: "plan", target: "write" }],
        },
        { features },
    );
    protected readonly flow = createFlowRef<Types, typeof features>();
    protected readonly message = signal(
        load<Saved>(KEY) ? "A saved flow is waiting." : "Nothing saved yet.",
    );

    protected onSave(): void {
        const engine = this.flow.current?.engine;
        if (!engine) return;
        const saved: Saved = {
            flow: this.model.get("flow-json"),
            viewport: engine.get("viewport"),
        };
        this.message.set(
            save(KEY, saved)
                ? `Saved ${saved.flow.nodes.length} nodes.`
                : "Storage is unavailable.",
        );
    }

    protected onRestore(): void {
        const engine = this.flow.current?.engine;
        if (!engine) return;
        const saved = load<Saved>(KEY);
        if (!saved) {
            this.message.set("Nothing saved yet.");
            return;
        }
        // storage is outside the app: check what comes back before loading it
        if (
            !isViewport(saved.viewport) ||
            validateFlow(saved.flow, { features }).length > 0
        ) {
            this.message.set("The saved flow is unreadable.");
            return;
        }
        const commands = this.model.get("commands-to", {
            nodes: saved.flow.nodes,
            edges: saved.flow.edges,
        });
        if (commands.length > 0)
            this.model.run("batch", { commands: [...commands] });
        engine.run("set-viewport", saved.viewport);
        this.message.set(`Restored ${saved.flow.nodes.length} nodes.`);
    }

    protected onAdd(): void {
        const engine = this.flow.current?.engine;
        if (!engine) return;
        const { x, y, zoom } = engine.get("viewport");
        const size = engine.get("root-size");
        const count = this.model.get("all-nodes").length;
        this.model.run("node.add", {
            type: "topic",
            // somewhere in view, in flow coordinates
            position: {
                x:
                    (size.width / 2 - x) / zoom -
                    60 +
                    Math.round(Math.random() * 120 - 60),
                y:
                    (size.height / 2 - y) / zoom -
                    20 +
                    Math.round(Math.random() * 120 - 60),
            },
            data: { label: `Topic ${count + 1}` },
        });
    }
}
