import { Component, input } from "@angular/core";
import { injectFlow } from "@fragiola/flow-angular";
import type { features, Node, Types } from "./index";
import { angleFrom, normalizeAngle } from "./rotation";
import { styles } from "./styles";

// The knob above the node: dragging it turns the node around its centre (`node.set-data` with the
// angle, transient while it moves), the arrows by a step, Home back to 0.

/** The knob's arrow step, and Shift's snap while dragging it (degrees). */
const STEP = 15;

@Component({
    selector: "example-shapes-rotate-handle",
    host: { class: "contents" },
    template: `
        <div
            role="slider"
            tabindex="0"
            [attr.aria-label]="'Rotate ' + node().data.label"
            aria-valuemin="0"
            aria-valuemax="359"
            [attr.aria-valuenow]="node().data.angle"
            [attr.aria-valuetext]="node().data.angle + ' degrees'"
            data-flow-no-gesture=""
            (pointerdown)="down($event)"
            (pointermove)="move($event)"
            (pointerup)="up($event)"
            (pointercancel)="turning = false"
            (keydown)="key($event)"
            [class]="styles.rotate"
        ></div>
    `,
})
export class RotateHandle {
    readonly node = input.required<Node>();
    /** The node's turned content, whose centre the knob turns around. */
    readonly frame = input.required<HTMLElement>();
    protected readonly styles = styles;
    private readonly flow = injectFlow<Types, typeof features>();
    protected turning = false;

    private rotate(angle: number, transient: boolean): void {
        this.flow
            .model()
            .run(
                "node.set-data",
                { nodeId: this.node().id, data: { angle } },
                { transient },
            );
    }

    private angleAt(event: PointerEvent): number {
        const box = this.frame().getBoundingClientRect();
        // the content turns around its centre, which a turn does not move
        const center = {
            x: box.left + box.width / 2,
            y: box.top + box.height / 2,
        };
        return angleFrom(
            center,
            { x: event.clientX, y: event.clientY },
            event.shiftKey ? STEP : 1,
        );
    }

    protected down(event: PointerEvent): void {
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
        this.turning = true;
    }

    protected move(event: PointerEvent): void {
        if (this.turning) this.rotate(this.angleAt(event), true);
    }

    protected up(event: PointerEvent): void {
        if (!this.turning) return;
        this.turning = false;
        this.rotate(this.angleAt(event), false);
    }

    protected key(event: KeyboardEvent): void {
        const by =
            event.key === "ArrowRight" || event.key === "ArrowUp"
                ? STEP
                : event.key === "ArrowLeft" || event.key === "ArrowDown"
                  ? -STEP
                  : undefined;
        if (event.key === "Home") this.rotate(0, false);
        else if (by !== undefined)
            this.rotate(normalizeAngle(this.node().data.angle + by), false);
        else return;
        event.preventDefault();
    }
}
