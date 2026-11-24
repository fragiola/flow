import { Component, computed, input, output } from "@angular/core";
import { type FlowNode, injectFlowStore } from "@fragiola/flow-angular";
import { LucideChevronDown, LucideChevronUp } from "@lucide/angular";
import type { features, Types } from "./index";
import { styles } from "./styles";
import { childrenOf, topicData } from "./tree";

/** The collapse toggle of a topic with children (none on a leaf): `toggle`, given the topic's id. */
@Component({
    selector: "example-auto-layout-toggle",
    imports: [LucideChevronDown, LucideChevronUp],
    host: { class: "contents" },
    template: `
        @if (parent()) {
            <button
                type="button"
                [attr.aria-expanded]="!collapsed()"
                [attr.aria-label]="(collapsed() ? 'Expand ' : 'Collapse ') + label()"
                (click)="toggle.emit(node().id)"
                [class]="styles.toggle"
            >
                @if (collapsed()) {
                    <svg lucideChevronDown aria-hidden="true" [class]="styles.icon"></svg>
                } @else {
                    <svg lucideChevronUp aria-hidden="true" [class]="styles.icon"></svg>
                }
            </button>
        }
    `,
})
export class Toggle {
    readonly node = input.required<FlowNode<Types>>();
    readonly toggle = output<string>();
    protected readonly styles = styles;
    protected readonly parent = injectFlowStore<
        boolean,
        Types,
        typeof features
    >(
        ({ model }) =>
            childrenOf(model.get("all-edges"), this.node().id).length > 0,
    );
    protected readonly label = computed(() => topicData(this.node()).label);
    protected readonly collapsed = computed(
        () => topicData(this.node()).collapsed ?? false,
    );
}
