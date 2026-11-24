import { Component, input } from "@angular/core";
import { injectFlowStore } from "@fragiola/flow-angular";
import { type features, linkFor, type Types } from "./index";
import { type Link, sameLink } from "./proximity";
import { styles } from "./styles";

// The temporary edge: a dashed line in flow coordinates, inside the viewport, while the dragged
// node is near another. Not a `[flowEdge]`: it is not in the document, nor focusable. Its store
// (`injectFlowStore`) runs again on every drag step, so the step checks this view alone.
@Component({
    selector: "example-temporary-edge",
    host: { class: "contents" },
    template: `
        @if (link(); as link) {
            <svg aria-hidden="true" [class]="styles.overlay">
                <line
                    data-testid="temporary-edge"
                    [attr.data-source]="link.source"
                    [attr.data-target]="link.target"
                    [attr.x1]="link.from.x"
                    [attr.y1]="link.from.y"
                    [attr.x2]="link.to.x"
                    [attr.y2]="link.to.y"
                    [class]="styles.temporary"
                />
            </svg>
        }
    `,
})
export class TemporaryEdge {
    /** the node being dragged */
    readonly nodeId = input.required<string>();
    protected readonly styles = styles;
    protected readonly link = injectFlowStore<
        Link | undefined,
        Types,
        typeof features
    >(({ model, engine }) => linkFor(model, engine, this.nodeId()), sameLink);
}
