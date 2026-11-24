import { Component, computed } from "@angular/core";
import { injectFlow, injectSelection } from "@fragiola/flow-angular";
import type { features, Types } from "./index";
import { styles } from "./styles";

/** The room a new group leaves around its nodes, and above them for its title. */
const MARGIN = 20;
const TITLE = 24;

/** Groups the selected top-level nodes into a new group, and ungroups the selected groups. */
@Component({
    selector: "example-sub-flows-grouping",
    host: { class: "contents" },
    template: `
        <div role="toolbar" aria-label="Grouping" data-flow-no-gesture [class]="styles.toolbar">
            <button
                type="button"
                [disabled]="loose().length < 2"
                (click)="group()"
                [class]="styles.button"
            >
                Group selection
            </button>
            <button
                type="button"
                [disabled]="groups().length === 0"
                (click)="ungroup()"
                [class]="styles.button"
            >
                Ungroup
            </button>
        </div>
    `,
})
export class Grouping {
    protected readonly styles = styles;
    private readonly flow = injectFlow<Types, typeof features>();
    private readonly selected = injectSelection<Types>();
    protected readonly loose = computed(() =>
        this.selected().nodes.filter((node) => node.parentId === undefined),
    );
    protected readonly groups = computed(() =>
        this.selected().nodes.filter((node) => node.type === "group"),
    );

    protected group(): void {
        const model = this.flow.model();
        const nodeIds = this.loose().map((node) => node.id);
        const bounds = this.flow.engine.get("nodes-bounds", { nodeIds });
        if (!bounds) return;
        let count = 1;
        while (model.get("node-by", { id: `group-${count}` })) count += 1;
        const groupId = `group-${count}`;
        model.run("batch", {
            commands: [
                {
                    command: "node.add",
                    payload: {
                        id: groupId,
                        type: "group",
                        position: {
                            x: bounds.x - MARGIN,
                            y: bounds.y - MARGIN - TITLE,
                        },
                        width: bounds.width + 2 * MARGIN,
                        height: bounds.height + 2 * MARGIN + TITLE,
                        data: { label: `Group ${count}` },
                    },
                },
                ...nodeIds.map((nodeId) => ({
                    command: "node.set-parent" as const,
                    payload: {
                        nodeId,
                        parentId: groupId,
                        extent: "parent" as const,
                    },
                })),
                {
                    command: "selection.set",
                    payload: { nodeIds: [groupId], mode: "replace" },
                },
            ],
        });
    }

    protected ungroup(): void {
        const model = this.flow.model();
        const groupIds = new Set(this.groups().map((node) => node.id));
        const children = model
            .get("all-nodes")
            .filter((node) => node.parentId && groupIds.has(node.parentId));
        model.run("batch", {
            commands: [
                ...children.map((node) => ({
                    command: "node.set-parent" as const,
                    payload: { nodeId: node.id, parentId: null, extent: null },
                })),
                ...[...groupIds].map((nodeId) => ({
                    command: "node.remove" as const,
                    payload: { nodeId },
                })),
            ],
        });
    }
}
