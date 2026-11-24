import { Component, computed, DestroyRef, inject, signal } from "@angular/core";
import { FLOW, FlowEdgeDirective, injectFlow } from "@fragiola/flow-angular";
import {
    movePoint,
    type Point,
    pathThrough,
    removePoint,
} from "./control-points";
import { type Features, nameOf, pointsOf, type Types } from "./index";
import { styles } from "./styles";

/** How far an arrow key moves a focused point (Shift: further). */
const STEP = 10;
const FAST_STEP = 50;

const ARROWS: Record<string, Point> = {
    ArrowUp: { x: 0, y: -1 },
    ArrowRight: { x: 1, y: 0 },
    ArrowDown: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 },
};

/**
 * An editable edge (on the edge's own group): drawn through its control points, each a control to
 * drag (the pointer captured by the point, so its moves come to it alone), move with the arrows or
 * remove with Delete. The ends are the edge's own (`flowEdge`'s `state().path`), read here so a
 * drag redraws this view alone. Both paths are always written (the edge never takes its default
 * one); their `d` and the points come once the edge has a path.
 */
@Component({
    selector: "[exampleBendableEdge]",
    imports: [FLOW],
    host: {
        "[attr.aria-label]": "name()",
        "[attr.data-points]": "points().length",
    },
    template: `
        @let drawn = d();
        <!-- a wide transparent path: a bigger target for a click and a double click -->
        <svg:path flowEdgePath [attr.d]="drawn" [class]="styles.edgeHit" />
        <svg:path flowEdgePath [attr.d]="drawn" [class]="styles.edge" />
        @if (drawn) {
            <!-- SVG has no <button>: the circle is the control; a point's place is its identity -->
            @for (point of points(); track $index; let index = $index) {
                <svg:circle
                    [attr.cx]="point.x"
                    [attr.cy]="point.y"
                    r="7"
                    tabindex="0"
                    role="button"
                    aria-roledescription="control point"
                    [attr.aria-label]="'Control point ' + (index + 1) + ' of ' + name()"
                    aria-keyshortcuts="ArrowUp ArrowRight ArrowDown ArrowLeft Delete Backspace"
                    data-flow-no-gesture=""
                    [attr.data-point]="index"
                    [attr.data-dragging]="dragging() === index ? '' : null"
                    (pointerdown)="onPointerDown($event, index)"
                    (pointermove)="onPointerMove($event, index)"
                    (lostpointercapture)="dragging.set(undefined)"
                    (keydown)="onKeyDown($event, index)"
                    [class]="styles.point"
                />
            }
        }
    `,
})
export class BendableEdge {
    protected readonly styles = styles;
    private readonly edge = inject<FlowEdgeDirective<Types>>(FlowEdgeDirective);
    private readonly flow = injectFlow<Types, Features>();
    protected readonly dragging = signal<number | undefined>(undefined);
    protected readonly points = computed(() => pointsOf(this.edge.flowEdge()));
    protected readonly name = computed(() => nameOf(this.edge.flowEdge()));
    protected readonly d = computed(() => {
        const path = this.edge.state()?.path;
        return path
            ? pathThrough([path.source, ...this.points(), path.target], 8)
            : undefined;
    });
    /** the frame that moves the focus after a point is removed */
    private frame: number | undefined;

    constructor() {
        inject(DestroyRef).onDestroy(() => {
            if (this.frame !== undefined) cancelAnimationFrame(this.frame);
        });
    }

    private save(next: Point[]): void {
        this.flow.model().run("edge.set-data", {
            edgeId: this.edge.flowEdge().id,
            data: { points: next },
        });
    }

    protected onPointerDown(event: PointerEvent, index: number): void {
        if (event.button !== 0) return;
        (event.currentTarget as SVGCircleElement).setPointerCapture(
            event.pointerId,
        );
        this.dragging.set(index);
    }

    protected onPointerMove(event: PointerEvent, index: number): void {
        if (this.dragging() !== index) return;
        const point = this.flow.engine.get("screen-to-flow", {
            x: event.clientX,
            y: event.clientY,
        });
        if (point) this.save(movePoint(this.points(), index, point));
    }

    protected onKeyDown(event: KeyboardEvent, index: number): void {
        const points = this.points();
        const arrow = ARROWS[event.key];
        if (arrow) {
            event.preventDefault();
            const step = event.shiftKey ? FAST_STEP : STEP;
            const point = points[index] as Point;
            this.save(
                movePoint(points, index, {
                    x: point.x + arrow.x * step,
                    y: point.y + arrow.y * step,
                }),
            );
            return;
        }
        if (event.key !== "Delete" && event.key !== "Backspace") return;
        event.preventDefault();
        const group = (event.currentTarget as SVGCircleElement).closest(
            '[data-flow-part="edge"]',
        );
        this.save(removePoint(points, index));
        // focus stays on the edge: the point before, else the one now in its place, else the edge
        if (this.frame !== undefined) cancelAnimationFrame(this.frame);
        this.frame = requestAnimationFrame(() => {
            this.frame = undefined;
            const next =
                group?.querySelector<SVGElement>(
                    `[data-point="${index - 1}"]`,
                ) ??
                group?.querySelector<SVGElement>(`[data-point="${index}"]`) ??
                (group as SVGElement | null);
            next?.focus();
        });
    }
}
