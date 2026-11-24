import { Component } from "@angular/core";
import { injectFlowStore } from "@fragiola/flow-angular";
import { type Guide, guidesOf, sameGuides } from "./alignment";
import { type features, OVERHANG, type Types } from "./index";
import { boxOf, othersOf } from "./snapping";
import { styles } from "./styles";

const NONE: Guide[] = [];

/** A guide's ends, past the boxes it joins by `OVERHANG`. */
function ends(guide: Guide) {
    const from = guide.from - OVERHANG;
    const to = guide.to + OVERHANG;
    return guide.axis === "x"
        ? { x1: guide.at, y1: from, x2: guide.at, y2: to }
        : { x1: from, y1: guide.at, x2: to, y2: guide.at };
}

// The guides of the node being dragged alone, in flow coordinates inside the viewport: a vertical
// line (`data-axis="x"`) where an x lines up, a horizontal one (`data-axis="y"`) where a y does.
// Its store (`injectFlowStore`) runs again on every drag step, so the step checks this view alone.
@Component({
    selector: "example-guides",
    host: { class: "contents" },
    template: `
        @if (guides().length > 0) {
            <svg aria-hidden="true" [class]="styles.overlay">
                @for (guide of guides(); track guide.axis + "-" + guide.at) {
                    @let line = ends(guide);
                    <svg:line
                        data-testid="guide"
                        [attr.data-axis]="guide.axis"
                        [attr.data-at]="guide.at"
                        [attr.x1]="line.x1"
                        [attr.y1]="line.y1"
                        [attr.x2]="line.x2"
                        [attr.y2]="line.y2"
                        [class]="styles.guide"
                    />
                }
            </svg>
        }
    `,
})
export class HelperLines {
    protected readonly styles = styles;
    protected readonly ends = ends;
    protected readonly guides = injectFlowStore<
        Guide[],
        Types,
        typeof features
    >(({ model, engine }) => {
        const dragging = engine.get("dragging-node-ids");
        const nodeId = dragging.length === 1 ? dragging[0] : undefined;
        if (nodeId === undefined) return NONE;
        const node = model.get("node-by", { id: nodeId });
        if (!node || node.parentId !== undefined) return NONE;
        return guidesOf(boxOf(node), othersOf(model.get("all-nodes"), nodeId));
    }, sameGuides);
}
