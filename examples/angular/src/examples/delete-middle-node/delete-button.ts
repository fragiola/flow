import { Component, input } from "@angular/core";
import { type FlowNode, injectFlow } from "@fragiola/flow-angular";
import { LucideTrash2 } from "@lucide/angular";
import { type Features, removeReconnecting, type Types } from "./index";

/** The node's own delete button: a button inside a node is left alone by the flow's gestures. */
@Component({
    selector: "button[exampleDeleteButton]",
    imports: [LucideTrash2],
    host: {
        type: "button",
        "[attr.aria-label]": "'Delete ' + node().data.label",
        "(click)": "remove()",
    },
    template: `<svg lucideTrash2 aria-hidden="true"></svg>`,
})
export class DeleteButton {
    readonly node = input.required<FlowNode<Types>>();
    private readonly flow = injectFlow<Types, Features>();

    protected remove(): void {
        removeReconnecting(this.flow.model(), [this.node().id]);
    }
}
