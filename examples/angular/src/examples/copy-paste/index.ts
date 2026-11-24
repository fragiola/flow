import {
    afterNextRender,
    Component,
    DestroyRef,
    ElementRef,
    inject,
    viewChild,
} from "@angular/core";
import {
    createFlowModel,
    FLOW,
    type FlowEdge,
    type FlowEdgeInput,
    type FlowNodeInput,
    type FlowTypes,
    type XY,
} from "@fragiola/flow-angular";
import { drag } from "@fragiola/flow-angular/drag";
import { keyboard } from "@fragiola/flow-angular/keyboard";
import { selection } from "@fragiola/flow-angular/selection";
import { ClipboardToolbar } from "./clipboard-toolbar";
import { styles } from "./styles";

// Copy and paste: Ctrl/⌘ + C copies the selected nodes and the edges between them, Ctrl/⌘ + X
// cuts them (`selection.remove`), Ctrl/⌘ + V pastes them with new ids in one `batch` that also
// selects them; the toolbar's buttons do the same. The keys are read with `watchKeyPress` (the
// library's own shortcuts use no Ctrl/⌘ + C, X or V). A paste goes under the pointer when it is
// over the flow (`screen-to-flow`), and each paste at the same place moves one step further. The
// clipboard is JSON with a marker (`clipboard.ts`): it is written to the system clipboard when the
// browser allows it, so another tab of this example can paste it, and kept in memory as well, for
// when reading the system clipboard is refused or it holds someone else's text.

export interface Types extends FlowTypes {
    readonly nodes: { step: { label: string } };
    readonly edges: { bezier: { name: string } };
}

export const features = [selection(), drag(), keyboard()] as const;

/** Where the pointer is over the flow (client coordinates), for a paste under it. */
export interface PointerRef {
    current: XY | undefined;
}

const nodes: FlowNodeInput<Types>[] = [
    {
        id: "idea",
        type: "step",
        position: { x: 0, y: 0 },
        data: { label: "Idea" },
    },
    {
        id: "sketch",
        type: "step",
        position: { x: 200, y: 0 },
        data: { label: "Sketch" },
    },
    {
        id: "build",
        type: "step",
        position: { x: 400, y: 0 },
        data: { label: "Build" },
    },
];

const edges: FlowEdgeInput<Types>[] = [
    {
        id: "idea-sketch",
        source: "idea",
        target: "sketch",
        data: { name: "Idea to Sketch" },
    },
    {
        id: "sketch-build",
        source: "sketch",
        target: "build",
        data: { name: "Sketch to Build" },
    },
];

/** The edge's name: its own, or its ends'. */
function edgeName(edge: FlowEdge<Types>) {
    const name = edge.data?.name;
    return typeof name === "string" ? name : `${edge.source} to ${edge.target}`;
}

@Component({
    selector: "example-copy-paste",
    imports: [FLOW, ClipboardToolbar],
    host: { class: "contents" },
    template: `
        <div
            #root
            flowRoot
            [model]="model"
            [fitView]="{ padding: 0.3, maxZoom: 1 }"
            role="group"
            aria-label="Copy and paste"
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
                            [attr.aria-label]="edgeName(edge)"
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
                            <div flowHandle type="target" side="left" [class]="styles.handle"></div>
                            {{ node.data.label }}
                            <div flowHandle type="source" side="right" [class]="styles.handle"></div>
                        </div>
                    </ng-template>
                </div>
            </div>
            <example-clipboard-toolbar [pointer]="pointer" />
            <p [class]="styles.hint">
                Click or Shift-click nodes · Ctrl/⌘ + C, X, V · a paste goes under the pointer
            </p>
        </div>
    `,
})
export default class CopyPasteExample {
    protected readonly styles = styles;
    protected readonly edgeName = edgeName;
    protected readonly model = createFlowModel<Types, typeof features>(
        { version: 1, nodes, edges },
        { features },
    );
    // where the pointer is over the flow (client coordinates), for a paste under it; read on a
    // paste, never rendered
    protected readonly pointer: PointerRef = { current: undefined };
    private readonly root = viewChild.required<string, ElementRef<HTMLElement>>(
        "root",
        {
            read: ElementRef,
        },
    );

    constructor() {
        // plain listeners, not template bindings, which would check the whole template (every
        // node) on every pointer step
        const onPointerMove = (event: PointerEvent) => {
            const overToolbar =
                event.target instanceof Element &&
                event.target.closest('[role="toolbar"]') !== null;
            this.pointer.current = overToolbar
                ? undefined
                : { x: event.clientX, y: event.clientY };
        };
        const onPointerLeave = () => {
            this.pointer.current = undefined;
        };
        let element: HTMLElement | undefined;
        afterNextRender(() => {
            element = this.root().nativeElement;
            element.addEventListener("pointermove", onPointerMove);
            element.addEventListener("pointerleave", onPointerLeave);
        });
        inject(DestroyRef).onDestroy(() => {
            element?.removeEventListener("pointermove", onPointerMove);
            element?.removeEventListener("pointerleave", onPointerLeave);
        });
    }
}
