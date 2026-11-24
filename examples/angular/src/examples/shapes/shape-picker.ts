import { Component, input, output } from "@angular/core";
import { FLOW, injectFlow } from "@fragiola/flow-angular";
import { LucidePencil } from "@lucide/angular";
import type { features, Node, Types } from "./index";
import { SHAPE_NAMES, SHAPES, type Shape, shapePath } from "./shape-path";
import { styles } from "./styles";

// The selected node's toolbar: one button per shape (`node.set-data`), and the label's pencil.

/** Each shape's outline as the picker's icon. */
const ICONS = SHAPES.map((shape) => ({
    shape,
    name: SHAPE_NAMES[shape],
    path: shapePath(shape, 22, 16, 1.5),
}));

@Component({
    selector: "example-shapes-picker",
    imports: [FLOW, LucidePencil],
    host: { class: "contents" },
    template: `
        <div
            flowNodeToolbar
            side="right"
            role="toolbar"
            [attr.aria-label]="'Shape of ' + node().data.label"
            [class]="styles.toolbar"
        >
            @for (option of options; track option.shape) {
                <button
                    type="button"
                    [attr.aria-label]="option.name"
                    [attr.aria-pressed]="node().data.shape === option.shape"
                    [class]="styles.pick"
                    (click)="pick(option.shape)"
                >
                    <svg viewBox="0 0 22 16" aria-hidden="true">
                        <svg:path [attr.d]="option.path" />
                    </svg>
                </button>
            }
            <button type="button" aria-label="Edit label" [class]="styles.pick" (click)="edit.emit()">
                <svg lucidePencil aria-hidden="true"></svg>
            </button>
        </div>
    `,
})
export class ShapePicker {
    readonly node = input.required<Node>();
    /** The pencil: edit the label in place. */
    readonly edit = output<void>();
    protected readonly styles = styles;
    protected readonly options = ICONS;
    private readonly flow = injectFlow<Types, typeof features>();

    protected pick(shape: Shape): void {
        this.flow.model().run("node.set-data", {
            nodeId: this.node().id,
            data: { shape },
        });
    }
}
