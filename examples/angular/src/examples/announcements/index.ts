import { Component, effect, signal } from "@angular/core";
import {
    createFlowModel,
    createFlowRef,
    FLOW,
    type FlowEngineEvent,
    type FlowModel,
    type FlowNodeInput,
    type FlowTypes,
} from "@fragiola/flow-angular";
import { connection } from "@fragiola/flow-angular/connection";
import { drag } from "@fragiola/flow-angular/drag";
import { keyboard } from "@fragiola/flow-angular/keyboard";
import { selection } from "@fragiola/flow-angular/selection";
import { styles } from "./styles";

// The package says nothing aloud: it has no text. The engine tells what happened
// (`engine.subscribe`: nodes moved, an edge connected, something removed), and the app writes it,
// in its own words and language, into a live region a screen reader reads (`role="status"`). The
// log beside it shows the same messages. Try it with the keyboard: Tab to a node, move it with the
// arrows, delete it with Delete.

interface Types extends FlowTypes {
    readonly nodes: { room: { label: string } };
}

const features = [selection(), drag(), connection(), keyboard()] as const;

const nodes: FlowNodeInput<Types>[] = [
    {
        id: "hall",
        type: "room",
        position: { x: 0, y: 0 },
        data: { label: "Hall" },
    },
    {
        id: "kitchen",
        type: "room",
        position: { x: 220, y: 0 },
        data: { label: "Kitchen" },
    },
    {
        id: "garden",
        type: "room",
        position: { x: 110, y: 140 },
        data: { label: "Garden" },
    },
];

type Model = FlowModel<Types, typeof features>;

/** The app's words for an engine event, or nothing for one it keeps quiet about. */
function describe(event: FlowEngineEvent, model: Model): string | undefined {
    const name = (id: string) => model.get("node-by", { id })?.data.label ?? id;
    const names = (ids: readonly string[]) => ids.map(name).join(", ");
    switch (event.type) {
        case "nodes-move":
            return `Moved ${names(event.nodeIds)}${event.source === "keyboard" ? " with the keyboard" : ""}.`;
        case "drag-cancel":
            return `Put ${names(event.nodeIds)} back.`;
        case "connect":
            return `Connected ${name(event.source)} to ${name(event.target)}.`;
        case "connect-cancel":
            return event.refused
                ? "That connection is not allowed."
                : undefined;
        case "remove": {
            const parts = [
                event.nodeIds.length > 0
                    ? `${event.nodeIds.length} node(s)`
                    : "",
                event.edgeIds.length > 0
                    ? `${event.edgeIds.length} edge(s)`
                    : "",
            ].filter(Boolean);
            return `Removed ${parts.join(" and ")}.`;
        }
        default:
            return undefined;
    }
}

@Component({
    selector: "example-announcements",
    imports: [FLOW],
    host: { class: "contents" },
    template: `
        <div
            flowRoot
            [model]="model"
            [flowRef]="flow"
            [fitView]="{ padding: 0.2, maxZoom: 1 }"
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
            <aside aria-label="What happened" [class]="styles.panel">
                <!-- read aloud: only the latest message -->
                <p role="status" data-testid="announcement" [class]="styles.latest">
                    {{ log()[0] ?? "Move, connect or delete a node." }}
                </p>
                <ol aria-label="Earlier" [class]="styles.log">
                    <!-- the log is a stack -->
                    @for (message of log().slice(1); track $index) {
                        <li>{{ message }}</li>
                    }
                </ol>
            </aside>
        </div>
    `,
})
export default class Announcements {
    protected readonly styles = styles;
    protected readonly model: Model = createFlowModel<Types, typeof features>(
        {
            version: 1,
            nodes,
            edges: [{ id: "hall-kitchen", source: "hall", target: "kitchen" }],
        },
        { features },
    );
    protected readonly flow = createFlowRef<Types, typeof features>();
    protected readonly log = signal<string[]>([]);

    constructor() {
        // the engine's events while the root lives: the effect follows the ref, and its cleanup
        // stops listening
        effect((onCleanup) => {
            const engine = this.flow.current?.engine;
            if (!engine) return;
            onCleanup(
                engine.subscribe((event) => {
                    const message = describe(event, this.model);
                    if (message)
                        this.log.update((previous) =>
                            [message, ...previous].slice(0, 6),
                        );
                }),
            );
        });
    }
}
