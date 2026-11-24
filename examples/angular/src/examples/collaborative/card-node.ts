import { Component, computed, inject, input } from "@angular/core";
import { FLOW, FlowNodeDirective } from "@fragiola/flow-angular";
import type { Types } from "./index";
import { styles } from "./styles";

/**
 * A card, on the node's own element, with the dashed frame of the other collaborators who have it
 * selected (`names`, from `sync.ts`'s `remoteSelection`).
 */
@Component({
    selector: "[exampleCardNode]",
    imports: [FLOW],
    host: {
        "[attr.aria-description]": "by() ? 'selected by ' + by() : null",
        "[attr.data-remote-selected]": "by() || null",
    },
    template: `
        <div
            flowHandle
            type="target"
            side="left"
            [attr.aria-label]="label() + ' input'"
            [class]="styles.handle"
        ></div>
        {{ label() }}
        <div
            flowHandle
            type="source"
            side="right"
            [attr.aria-label]="label() + ' output'"
            [class]="styles.handle"
        ></div>
        @if (lead(); as lead) {
            <span aria-hidden="true" [class]="styles.mark(lead)">
                <span [class]="styles.markName">{{ by() }}</span>
            </span>
        }
    `,
})
export class CardNode {
    readonly names = input<readonly string[] | undefined>(undefined);

    protected readonly styles = styles;
    private readonly node = inject<FlowNodeDirective<Types>>(FlowNodeDirective);
    protected readonly label = computed(() => this.node.flowNode().data.label);
    protected readonly by = computed(() => this.names()?.join(", "));
    // the first of them gives the mark its colour
    protected readonly lead = computed(() => this.names()?.[0]);
}
