import { Component } from "@angular/core";
import {
    createFlowModel,
    FLOW,
    type FlowNode,
    type FlowNodeInput,
    type FlowTypes,
} from "@fragiola/flow-angular";
import { drag } from "@fragiola/flow-angular/drag";
import { selection } from "@fragiola/flow-angular/selection";
import { LucideCopy, LucideTrash2 } from "@lucide/angular";
import { styles } from "./styles";

// `flowNodeToolbar` stands next to its node, outside the zoom: it keeps its size whatever the
// zoom, and shows while its node is selected (or as `open` says). Its buttons run commands:
// duplicate (`node.add` with a new id), recolour (`node.set-data`) and delete (`node.remove`).

const TONES = ["blue", "green", "orange", "purple"] as const;
type Tone = (typeof TONES)[number];

interface Types extends FlowTypes {
    readonly nodes: { sticky: { text: string; tone: Tone } };
}

const features = [selection(), drag()] as const;

const nodes: FlowNodeInput<Types>[] = [
    {
        id: "idea",
        type: "sticky",
        position: { x: 0, y: 0 },
        selected: true,
        data: { text: "Select a note", tone: "blue" },
    },
    {
        id: "todo",
        type: "sticky",
        position: { x: 220, y: 60 },
        data: { text: "Then use its toolbar", tone: "orange" },
    },
];

let copies = 0;

@Component({
    selector: "example-node-toolbar",
    imports: [FLOW, LucideCopy, LucideTrash2],
    host: { class: "contents" },
    template: `
        <div flowRoot [model]="model" [fitView]="{ padding: 0.2, maxZoom: 1 }" [class]="styles.root">
            <svg flowBackground variant="dots" [size]="2" [class]="styles.dots"></svg>
            <svg flowBackground variant="lines" [class]="styles.lines"></svg>
            <svg flowBackground variant="cross" [class]="styles.cross"></svg>
            <div flowViewport>
                <div flowNodes>
                    <ng-template [flowNodesItem]="model" let-node>
                        <div [flowNode]="node" [class]="styles.sticky(node.data.tone)">
                            {{ node.data.text }}
                            <div
                                flowNodeToolbar
                                role="toolbar"
                                [attr.aria-label]="node.data.text + ': actions'"
                                [class]="styles.toolbar"
                            >
                                <button
                                    type="button"
                                    aria-label="Duplicate"
                                    [class]="styles.action"
                                    (click)="duplicate(node)"
                                >
                                    <svg lucideCopy aria-hidden="true"></svg>
                                </button>
                                @for (tone of tones; track tone) {
                                    <button
                                        type="button"
                                        [attr.aria-label]="'Make it ' + tone"
                                        [attr.aria-pressed]="node.data.tone === tone"
                                        [class]="styles.tone(tone)"
                                        (click)="recolour(node, tone)"
                                    ></button>
                                }
                                <button
                                    type="button"
                                    aria-label="Delete"
                                    [class]="styles.delete"
                                    (click)="remove(node)"
                                >
                                    <svg lucideTrash2 aria-hidden="true"></svg>
                                </button>
                            </div>
                        </div>
                    </ng-template>
                </div>
            </div>
        </div>
    `,
})
export default class NodeToolbarExample {
    protected readonly styles = styles;
    protected readonly tones = TONES;
    protected readonly model = createFlowModel<Types, typeof features>(
        { version: 1, nodes, edges: [] },
        { features },
    );

    protected duplicate(node: FlowNode<Types>): void {
        copies += 1;
        this.model.run("node.add", {
            id: `${node.id}-copy-${copies}`,
            type: "sticky",
            position: { x: node.position.x + 30, y: node.position.y + 30 },
            data: node.data,
        });
    }

    protected recolour(node: FlowNode<Types>, tone: Tone): void {
        this.model.run("node.set-data", { nodeId: node.id, data: { tone } });
    }

    protected remove(node: FlowNode<Types>): void {
        this.model.run("node.remove", { nodeId: node.id });
    }
}
