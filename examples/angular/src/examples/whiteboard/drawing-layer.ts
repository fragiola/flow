import {
    Component,
    computed,
    DestroyRef,
    inject,
    input,
    output,
    signal,
} from "@angular/core";
import { injectFlow } from "@fragiola/flow-angular";
import { type Segment, wiped } from "./eraser";
import type { Features, Tool, Types } from "./index";
import { insideLasso } from "./lasso";
import {
    addPoint,
    type Bounds,
    boundsOf,
    type Point,
    pathOf,
    smooth,
    strokeOf,
} from "./stroke";
import { styles } from "./styles";

/** A drawn shape smaller than this (flow units) on either side is a slip, not a rectangle. */
const MIN_SIZE = 8;
/** How near (flow units) the eraser must pass to a node or an edge to wipe it. */
const REACH = 6;

let count = 0;

/**
 * The layer a drawing tool draws on, over the flow: it takes the pointer, shows what is being
 * drawn (in its own pixels) and, when the pointer is released, changes the flow through the model.
 * Its points change on every pointer move: they are read here, so a move redraws this view alone.
 * A press it holds when it goes away (the tool changed) gives the pointer back.
 */
@Component({
    selector: "example-whiteboard-drawing-layer",
    host: { class: "contents" },
    template: `
        <!-- a pointer surface, as React's (no role): what it does is told by the status -->
        <div
            data-flow-no-gesture=""
            [attr.data-drawing]="points().length > 0 ? '' : null"
            (pointerdown)="onPointerDown($event)"
            (pointermove)="onPointerMove($event)"
            (pointerup)="finish()"
            (pointercancel)="cancel()"
            [class]="styles.layer"
        >
            <svg aria-hidden="true" [class]="styles.preview">
                @let rect = box();
                @if (rect) {
                    <svg:rect
                        [attr.x]="rect.x"
                        [attr.y]="rect.y"
                        [attr.width]="rect.width"
                        [attr.height]="rect.height"
                        [class]="styles.previewRect"
                    />
                }
                @let d = path();
                @if (d) {
                    <svg:path [attr.d]="d" [class]="pathClass()" />
                }
            </svg>
        </div>
    `,
})
export class DrawingLayer {
    readonly tool = input.required<Exclude<Tool, "select">>();
    /** the ids the current wipe has touched (none once it ends) */
    readonly erasing = output<ReadonlySet<string>>();
    /** what the last drawing did, for the status */
    readonly status = output<string>();
    protected readonly styles = styles;
    private readonly flow = injectFlow<Types, Features>();
    // the pointer's client points, and the layer's corner when the press began
    protected readonly points = signal<Point[]>([]);
    private readonly corner = signal<Point>({ x: 0, y: 0 });
    private wipe = { nodeIds: new Set<string>(), edgeIds: new Set<string>() };
    /** the element and pointer of the press in progress, released if the layer goes away */
    private captured: { element: HTMLElement; pointerId: number } | undefined;

    // what is being drawn, in the layer's own pixels
    private readonly local = computed(() => {
        const corner = this.corner();
        return this.points().map((point) => ({
            x: point.x - corner.x,
            y: point.y - corner.y,
        }));
    });
    protected readonly box = computed<Bounds | undefined>(() =>
        this.tool() === "rectangle" ? boundsOf(this.local()) : undefined,
    );
    protected readonly path = computed(() => {
        const local = this.local();
        if (local.length < 2) return undefined;
        switch (this.tool()) {
            case "freehand":
                return pathOf(smooth(local));
            case "eraser":
                return pathOf(local);
            case "lasso":
                return `${pathOf(local)} Z`;
            default:
                return undefined;
        }
    });
    protected readonly pathClass = computed(() => {
        switch (this.tool()) {
            case "freehand":
                return styles.previewStroke;
            case "eraser":
                return styles.previewTrail;
            default:
                return styles.previewLasso;
        }
    });

    constructor() {
        inject(DestroyRef).onDestroy(() => this.release());
    }

    private release(): void {
        const captured = this.captured;
        this.captured = undefined;
        if (captured?.element.hasPointerCapture(captured.pointerId)) {
            captured.element.releasePointerCapture(captured.pointerId);
        }
    }

    private toFlow = (point: Point): Point =>
        this.flow.engine.get("screen-to-flow", point) ?? point;

    /** The nodes' boxes, in flow coordinates. */
    private boxes() {
        return this.flow
            .model()
            .get("all-nodes")
            .flatMap((node) => {
                const box = this.flow.engine.get("node-rect-by", {
                    nodeId: node.id,
                });
                return box ? [{ id: node.id, box }] : [];
            });
    }

    /** Marks what the run from `from` to `to` (client points) wipes. */
    private erase(from: Point, to: Point): void {
        const lines = this.flow
            .model()
            .get("all-edges")
            .flatMap((edge) => {
                const path = this.flow.engine.get("edge-path-by", {
                    edgeId: edge.id,
                });
                return path
                    ? [
                          {
                              id: edge.id,
                              line: { a: path.source, b: path.target },
                          },
                      ]
                    : [];
            });
        const run: Segment = { a: this.toFlow(from), b: this.toFlow(to) };
        const hit = wiped(run, { nodes: this.boxes(), edges: lines }, REACH);
        if (hit.nodeIds.length === 0 && hit.edgeIds.length === 0) return;
        for (const id of hit.nodeIds) this.wipe.nodeIds.add(id);
        for (const id of hit.edgeIds) this.wipe.edgeIds.add(id);
        this.erasing.emit(
            new Set([...this.wipe.nodeIds, ...this.wipe.edgeIds]),
        );
    }

    protected onPointerDown(event: PointerEvent): void {
        if (event.button !== 0) return;
        const element = event.currentTarget as HTMLElement;
        element.setPointerCapture(event.pointerId);
        this.captured = { element, pointerId: event.pointerId };
        const box = element.getBoundingClientRect();
        this.corner.set({ x: box.x, y: box.y });
        const point = { x: event.clientX, y: event.clientY };
        this.wipe = { nodeIds: new Set(), edgeIds: new Set() };
        this.points.set([point]);
        if (this.tool() === "eraser") this.erase(point, point);
    }

    protected onPointerMove(event: PointerEvent): void {
        const points = this.points();
        const last = points.at(-1);
        if (!last) return;
        const point = { x: event.clientX, y: event.clientY };
        if (this.tool() === "rectangle") {
            this.points.set([points[0] as Point, point]);
            return;
        }
        const next = addPoint(points, point, 2);
        if (next.length === points.length) return;
        if (this.tool() === "eraser") this.erase(last, point);
        this.points.set(next);
    }

    protected finish(): void {
        this.captured = undefined;
        const points = this.points();
        if (points.length === 0) return;
        const flowPoints = points.map(this.toFlow);
        this.points.set([]);
        const model = this.flow.model();
        const tool = this.tool();
        if (tool === "rectangle") {
            const box = boundsOf(flowPoints);
            if (!box || box.width < MIN_SIZE || box.height < MIN_SIZE) return;
            count += 1;
            model.run("node.add", {
                id: `rectangle-${count}`,
                type: "shape",
                position: { x: box.x, y: box.y },
                width: Math.round(box.width),
                height: Math.round(box.height),
                data: { label: `Rectangle ${count}` },
            });
            this.status.emit(`Rectangle ${count} drawn.`);
        } else if (tool === "freehand") {
            const stroke = strokeOf(flowPoints, 4);
            if (!stroke) return;
            count += 1;
            model.run("node.add", {
                id: `stroke-${count}`,
                type: "stroke",
                position: stroke.position,
                width: Math.round(stroke.width),
                height: Math.round(stroke.height),
                data: { label: `Stroke ${count}`, d: stroke.d },
            });
            this.status.emit(`Stroke ${count} drawn.`);
        } else if (tool === "eraser") {
            const { nodeIds, edgeIds } = this.wipe;
            this.wipe = { nodeIds: new Set(), edgeIds: new Set() };
            this.erasing.emit(new Set());
            const removed = nodeIds.size + edgeIds.size;
            if (removed === 0) return;
            // the edges first: a removed node takes its other edges with it
            model.run("batch", {
                commands: [
                    ...[...edgeIds].map((edgeId) => ({
                        command: "edge.remove" as const,
                        payload: { edgeId },
                    })),
                    ...[...nodeIds].map((nodeId) => ({
                        command: "node.remove" as const,
                        payload: { nodeId },
                    })),
                ],
            });
            this.status.emit(
                `Erased ${removed} ${removed === 1 ? "item" : "items"}.`,
            );
        } else {
            const nodeIds = insideLasso(this.boxes(), flowPoints);
            model.run("selection.set", { nodeIds, edgeIds: [] });
            this.status.emit(
                `${nodeIds.length} ${nodeIds.length === 1 ? "node" : "nodes"} selected.`,
            );
        }
    }

    protected cancel(): void {
        this.captured = undefined;
        this.points.set([]);
        this.wipe = { nodeIds: new Set(), edgeIds: new Set() };
        this.erasing.emit(new Set());
    }
}
