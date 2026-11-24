import { Component, computed, inject, input } from "@angular/core";
import { FlowNodeDirective } from "@fragiola/flow-angular";
import { LucidePin } from "@lucide/angular";
import type { Types } from "./index";
import { styles } from "./styles";

/**
 * A service, on the node's own element: its label, its place (`data-position`) and, pinned in the
 * simulation, a pin (`pinned`, the pinned set's answer for this node).
 */
@Component({
    selector: "[exampleServiceNode]",
    imports: [LucidePin],
    host: {
        "[attr.aria-label]": "label()",
        "[attr.data-position]": "position()",
        "[attr.data-pinned]": "pinned() ? '' : null",
    },
    template: `
        {{ label() }}
        @if (pinned()) {
            <span [class]="styles.pin" aria-hidden="true">
                <svg lucidePin></svg>
            </span>
        }
    `,
})
export class ServiceNode {
    readonly pinned = input(false);

    protected readonly styles = styles;
    private readonly node = inject<FlowNodeDirective<Types>>(FlowNodeDirective);
    protected readonly label = computed(() => this.node.flowNode().data.label);
    protected readonly position = computed(() => {
        const { x, y } = this.node.flowNode().position;
        return `${Math.round(x)}, ${Math.round(y)}`;
    });
}
