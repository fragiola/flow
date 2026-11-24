import { Component, computed, inject } from "@angular/core";
import {
    FlowConnectionLineDirective,
    injectFlowStore,
} from "@fragiola/flow-angular";
import type { features, Types } from "./index";
import {
    elbowPath,
    otherSources,
    type Start,
    sameStarts,
} from "./multi-connection";
import { styles } from "./styles";

/**
 * The connection line's drawing, in flow coordinates: an elbow from the pressed handle, one from
 * each other selected node's source handle, and a ring where they meet. It sits on the line's own
 * element (`<svg flowConnectionLine exampleLines>`) and reads the connection from that
 * `flowConnectionLine`'s `state()`, so a pointer move checks this view alone. Its own line and
 * ring are always written (the line is in the document only while a connection is drawn), so the
 * line never takes its default path.
 */
@Component({
    selector: "[exampleLines]",
    template: `
        @let to = connection()?.toPoint;
        @for (start of starts(); track start.id) {
            <svg:path
                data-testid="extra-line"
                [attr.data-source]="start.id"
                [attr.d]="to ? elbow(start, to) : null"
                [class]="styles.extra"
            />
        }
        <svg:path data-testid="custom-line" [attr.d]="path()" [class]="styles.line" />
        <svg:circle [attr.cx]="to?.x" [attr.cy]="to?.y" r="5" [class]="styles.end" />
    `,
})
export class Lines {
    protected readonly styles = styles;
    protected readonly elbow = elbowPath;
    private readonly line = inject(FlowConnectionLineDirective);
    /** the connection being drawn, `undefined` while none is */
    protected readonly connection = computed(
        () => this.line.state()?.connection,
    );
    protected readonly path = computed(() => {
        const connection = this.connection();
        return connection
            ? elbowPath(connection.fromPoint, connection.toPoint)
            : null;
    });
    /** the other selected nodes' source handles, where their lines start */
    protected readonly starts = injectFlowStore<
        readonly Start[],
        Types,
        typeof features
    >(({ model, engine }) => {
        const from = this.connection()?.from.nodeId;
        if (from === undefined) return [];
        return otherSources(
            from,
            model.get("selected-nodes").map((node) => node.id),
        ).flatMap((nodeId) => {
            const center = engine
                .get("handles-by", { nodeId })
                .find((handle) => handle.type === "source")?.center;
            return center ? [{ id: nodeId, ...center }] : [];
        });
    }, sameStarts);
}
