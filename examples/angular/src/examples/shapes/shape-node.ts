import { Component, computed, input, output } from "@angular/core";
import { FLOW } from "@fragiola/flow-angular";
import { FLOW_RESIZE, RESIZE_POSITIONS } from "@fragiola/flow-angular/resize";
import type { Node } from "./index";
import { RotateHandle } from "./rotate-handle";
import { rotatedSide, type Side } from "./rotation";
import { ShapeLabel } from "./shape-label";
import { shapePath } from "./shape-path";
import { ShapePicker } from "./shape-picker";
import { styles } from "./styles";

// A node's content: its shape's outline, its label, the rotation knob and the two handles, all
// turned by the node's angle; then its resizer and its toolbar, which do not turn. It renders
// inside its node's element (`<div [flowNode]="node" [exampleShapeNode]="node">`): the resizer is
// the node's own child, as its style expects.

/** Where a handle sits on the node's unturned content: the middle of its side. */
const PLACE: Record<Side, Record<string, string | number>> = {
    top: { top: 0, left: "50%", transform: "translate(-50%, -50%)" },
    right: { top: "50%", left: "100%", transform: "translate(-50%, -50%)" },
    bottom: { top: "100%", left: "50%", transform: "translate(-50%, -50%)" },
    left: { top: "50%", left: 0, transform: "translate(-50%, -50%)" },
};

@Component({
    selector: "[exampleShapeNode]",
    imports: [FLOW, FLOW_RESIZE, RotateHandle, ShapeLabel, ShapePicker],
    template: `
        <div
            #frame
            [attr.data-shape]="node().data.shape"
            [attr.data-angle]="node().data.angle"
            [style.transform]="'rotate(' + node().data.angle + 'deg)'"
            [class]="styles.frame"
        >
            <svg [attr.viewBox]="'0 0 ' + width() + ' ' + height()" aria-hidden="true" [class]="styles.svg">
                <svg:path [attr.d]="outline()" [class]="styles.outline" />
            </svg>
            <example-shapes-label [node]="node()" [editing]="editing()" (editingChange)="editingChange.emit($event)" />
            <example-shapes-rotate-handle [node]="node()" [frame]="frame" />
            <!-- remounted on a turn: measured again where the turn put it -->
            @for (angle of angles(); track angle) {
                <div
                    flowHandle
                    type="target"
                    [side]="side('top', angle)"
                    [attr.aria-label]="node().data.label + ' input'"
                    [style]="place.top"
                    [class]="styles.handle"
                ></div>
                <div
                    flowHandle
                    type="source"
                    [side]="side('bottom', angle)"
                    [attr.aria-label]="node().data.label + ' output'"
                    [style]="place.bottom"
                    [class]="styles.handle"
                ></div>
            }
        </div>
        <div flowNodeResizer [class]="styles.resizer">
            @for (position of positions; track position) {
                <div
                    flowResizeHandle
                    [position]="position"
                    [attr.aria-label]="'Resize ' + node().data.label + ': ' + position"
                    [class]="styles.resizeHandle"
                ></div>
            }
        </div>
        <example-shapes-picker [node]="node()" (edit)="editingChange.emit(true)" />
    `,
})
export class ShapeNode {
    readonly node = input.required<Node>({ alias: "exampleShapeNode" });
    /** Whether its label is edited in place. */
    readonly editing = input(false);
    /** The label's edit opens (`true`) or closes (`false`). */
    readonly editingChange = output<boolean>();
    protected readonly styles = styles;
    protected readonly place = PLACE;
    protected readonly positions = RESIZE_POSITIONS;
    protected readonly side = rotatedSide;
    protected readonly width = computed(() => this.node().width ?? 140);
    protected readonly height = computed(() => this.node().height ?? 64);
    protected readonly outline = computed(() =>
        shapePath(this.node().data.shape, this.width(), this.height(), 1.5),
    );
    /** The angle, as the one item the handles are rendered for: a new angle remounts them. */
    protected readonly angles = computed(() => [this.node().data.angle]);
}
