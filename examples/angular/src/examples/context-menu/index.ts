import {
    afterRenderEffect,
    Component,
    type ElementRef,
    signal,
    viewChild,
} from "@angular/core";
import {
    createFlowModel,
    FLOW,
    type FlowEngineEventOf,
    type FlowNodeInput,
    type FlowTypes,
    type XY,
} from "@fragiola/flow-angular";
import { drag } from "@fragiola/flow-angular/drag";
import { keyboard } from "@fragiola/flow-angular/keyboard";
import { selection } from "@fragiola/flow-angular/selection";
import { styles } from "./styles";

// A context menu of your own. The root tells a right click (or the menu key) where it happened:
// `(nodeContextMenu)` on a node, `(selectionContextMenu)` on one of several selected nodes,
// `(paneContextMenu)` on the canvas, each with the client point (`client`), the flow point
// (`point`) and the DOM event, whose default the example prevents to show its menu instead of the
// browser's. The menu stands at the client point inside the frame; a click on the canvas or a
// node, Escape, a pan, focus leaving it or a choice closes it, and focus goes back to the task (or
// the canvas) it was opened on. With `keyboard()` tasks take focus, so the menu key (or Shift +
// F10) opens a task's menu too; the arrows walk its items. `(nodeDoubleClick)` marks a task done,
// as the menu's first item does. These come from the engine's own taps: a right click that ended
// a pan opens nothing.

interface Types extends FlowTypes {
    readonly nodes: { task: { label: string; done: boolean } };
}

const features = [selection(), drag(), keyboard()] as const;

const nodes: FlowNodeInput<Types>[] = [
    {
        id: "plan",
        type: "task",
        position: { x: 0, y: 0 },
        data: { label: "Plan", done: false },
    },
    {
        id: "build",
        type: "task",
        position: { x: 200, y: 80 },
        data: { label: "Build", done: false },
    },
    {
        id: "ship",
        type: "task",
        position: { x: 400, y: 0 },
        data: { label: "Ship", done: false },
    },
];

/** What the menu acts on, and where it stands (relative to the frame). */
type Menu =
    | { kind: "node"; nodeId: string; at: XY }
    | { kind: "selection"; nodeIds: readonly string[]; at: XY }
    | { kind: "pane"; point: XY; at: XY };

let added = 0;

@Component({
    selector: "example-context-menu",
    imports: [FLOW],
    host: { class: "contents" },
    template: `
        <div #frame [class]="styles.frame">
            <div
                flowRoot
                [model]="model"
                [fitView]="{ padding: 0.3, maxZoom: 1 }"
                [class]="styles.root"
                (nodeContextMenu)="onNode($event)"
                (selectionContextMenu)="onSelection($event)"
                (paneContextMenu)="onPane($event)"
                (paneClick)="close()"
                (nodeClick)="close()"
                (moveStart)="close()"
                (nodeDoubleClick)="toggleDone($event.nodeId)"
            >
                <svg flowBackground variant="dots" [size]="2" [class]="styles.dots"></svg>
                <svg flowBackground variant="lines" [class]="styles.lines"></svg>
                <svg flowBackground variant="cross" [class]="styles.cross"></svg>
                <div flowViewport>
                    <div flowNodes>
                        <ng-template [flowNodesItem]="model" let-node>
                            <div
                                [flowNode]="node"
                                role="group"
                                [attr.aria-label]="node.data.label + (node.data.done ? ', done' : '')"
                                [class]="styles.node"
                            >
                                {{ node.data.done ? "✓ " + node.data.label : node.data.label }}
                                <div flowHandle type="target" side="left" [class]="styles.handle"></div>
                                <div flowHandle type="source" side="right" [class]="styles.handle"></div>
                            </div>
                        </ng-template>
                    </div>
                </div>
            </div>
            @if (menu(); as menu) {
                <div
                    role="menu"
                    aria-label="Actions"
                    tabindex="-1"
                    [style.left.px]="menu.at.x"
                    [style.top.px]="menu.at.y"
                    [class]="styles.menu"
                    (keydown)="onMenuKey($event)"
                    (focusout)="onFocusOut($event)"
                >
                    @switch (menu.kind) {
                        @case ("node") {
                            <button
                                #first
                                type="button"
                                role="menuitem"
                                [class]="styles.item"
                                (click)="toggleDone(menu.nodeId); close()"
                            >
                                {{ isDone(menu.nodeId) ? "Mark not done" : "Mark done" }}
                            </button>
                            <button
                                type="button"
                                role="menuitem"
                                [class]="styles.item"
                                (click)="duplicate(menu.nodeId)"
                            >
                                Duplicate
                            </button>
                            <button
                                type="button"
                                role="menuitem"
                                [class]="styles.danger"
                                (click)="remove([menu.nodeId])"
                            >
                                Delete
                            </button>
                        }
                        @case ("selection") {
                            <button
                                #first
                                type="button"
                                role="menuitem"
                                [class]="styles.danger"
                                (click)="remove(menu.nodeIds)"
                            >
                                Delete {{ menu.nodeIds.length }} tasks
                            </button>
                        }
                        @case ("pane") {
                            <button
                                #first
                                type="button"
                                role="menuitem"
                                [class]="styles.item"
                                (click)="addAt(menu.point)"
                            >
                                Add a task here
                            </button>
                        }
                    }
                </div>
            }
        </div>
    `,
})
export default class ContextMenu {
    protected readonly styles = styles;
    protected readonly model = createFlowModel<Types, typeof features>(
        { version: 1, nodes, edges: [] },
        { features },
    );
    protected readonly menu = signal<Menu | null>(null);
    private readonly frame =
        viewChild.required<ElementRef<HTMLDivElement>>("frame");
    private readonly first = viewChild<ElementRef<HTMLButtonElement>>("first");

    constructor() {
        // each menu opened focuses its first item
        afterRenderEffect(() => {
            if (this.menu()) this.first()?.nativeElement.focus();
        });
    }

    /** The menu's place: the client point, inside the frame. */
    private at(client: XY): XY {
        const box = this.frame().nativeElement.getBoundingClientRect();
        return { x: client.x - box.x, y: client.y - box.y };
    }

    /** Opens a menu instead of the browser's. */
    private open(
        event: { event: MouseEvent; client: XY },
        next: (where: XY) => Menu,
    ): void {
        event.event.preventDefault();
        this.menu.set(next(this.at(event.client)));
    }

    protected onNode(event: FlowEngineEventOf<"node-context-menu">): void {
        this.open(event, (where) => ({
            kind: "node",
            nodeId: event.nodeId,
            at: where,
        }));
    }

    protected onSelection(
        event: FlowEngineEventOf<"selection-context-menu">,
    ): void {
        this.open(event, (where) => ({
            kind: "selection",
            nodeIds: event.nodeIds,
            at: where,
        }));
    }

    protected onPane(event: FlowEngineEventOf<"pane-context-menu">): void {
        this.open(event, (where) => ({
            kind: "pane",
            point: event.point,
            at: where,
        }));
    }

    /** Closes the menu, giving focus back to the task it was opened on (or the canvas). */
    protected close(): void {
        const menu = this.menu();
        if (!menu) return;
        const frame = this.frame().nativeElement;
        const opener =
            (menu.kind === "node"
                ? frame.querySelector<HTMLElement>(
                      `[data-flow-part="node"][data-flow-id="${menu.nodeId}"]`,
                  )
                : undefined) ??
            frame.querySelector<HTMLElement>('[data-flow-part="root"]');
        this.menu.set(null);
        opener?.focus({ preventScroll: true });
    }

    /** The arrows, Home and End walk the menu's items; Escape closes it. */
    protected onMenuKey(event: KeyboardEvent): void {
        if (event.key === "Escape") {
            event.preventDefault();
            this.close();
            return;
        }
        const menu = event.currentTarget as HTMLElement;
        const items = [
            ...menu.querySelectorAll<HTMLElement>('[role="menuitem"]'),
        ];
        const at = items.indexOf(document.activeElement as HTMLElement);
        const next =
            event.key === "ArrowDown"
                ? (at + 1) % items.length
                : event.key === "ArrowUp"
                  ? (at - 1 + items.length) % items.length
                  : event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? items.length - 1
                      : -1;
        if (next < 0) return;
        event.preventDefault();
        items[next]?.focus();
    }

    /** Focus left the menu (Tab, a click elsewhere): it closes. */
    protected onFocusOut(event: FocusEvent): void {
        const menu = event.currentTarget as HTMLElement;
        if (!menu.contains(event.relatedTarget as Node | null)) {
            this.menu.set(null);
        }
    }

    /** The task is marked done (the menu's first item tells which way it goes). */
    protected isDone(nodeId: string): boolean {
        return this.model.get("node-by", { id: nodeId })?.data.done === true;
    }

    protected toggleDone(nodeId: string): void {
        const node = this.model.get("node-by", { id: nodeId });
        if (node)
            this.model.run("node.set-data", {
                nodeId,
                data: { done: !node.data.done },
            });
    }

    protected duplicate(nodeId: string): void {
        const node = this.model.get("node-by", { id: nodeId });
        if (!node) return;
        added += 1;
        this.model.run("node.add", {
            id: `${nodeId}-copy-${added}`,
            type: "task",
            position: { x: node.position.x + 30, y: node.position.y + 60 },
            data: { label: `${node.data.label} copy`, done: false },
        });
        this.close();
    }

    protected remove(nodeIds: readonly string[]): void {
        this.model.run("batch", {
            commands: nodeIds.map((nodeId) => ({
                command: "node.remove" as const,
                payload: { nodeId },
            })),
        });
        this.close();
    }

    protected addAt(point: XY): void {
        added += 1;
        this.model.run("node.add", {
            id: `task-${added}`,
            type: "task",
            position: point,
            data: { label: `Task ${added}`, done: false },
        });
        this.close();
    }
}
