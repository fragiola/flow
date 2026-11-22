import { computed, Directive, input, type Signal } from "@angular/core";
import type { EdgeToolbarPosition, PartAttributes, XY } from "@fragiola/flow";
import { injectEdgeContext, injectFlowContext } from "../context";
import { flowValue, partOwnerId } from "../inject/internal";
import {
    bindAttributes,
    bindStructuralStyle,
    injectHost,
    optionalBoolean,
} from "../utils/helpers";
import { bindPresence } from "../utils/presence";

export interface EdgeToolbarState {
    readonly edgeId: string;
    /** the point of the edge it stands at */
    readonly position: "label" | "source" | "target";
    /** where it is anchored (its `alignX` / `alignY` point), in pixels relative to the root */
    readonly anchor: EdgeToolbarPosition;
}

interface ToolbarView {
    anchor: EdgeToolbarPosition;
    attributes: PartAttributes;
}

/**
 * A toolbar on an edge (`data-flow-part="toolbar"`, `data-flow-id` its edge's id), on the app's
 * HTML element, written inside `[flowEdge]` with the `xhtml:` prefix (`<xhtml:div
 * flowEdgeToolbar>`: the edge is SVG, the toolbar HTML) and moved into `[flowRoot]` (outside the
 * zoom), at the point `edge-toolbar-by` gives (the edge's label point, one of its ends or its
 * `point`; centred unless `alignX` / `alignY` say otherwise), so it keeps its size at any zoom. It
 * is in the document only while it is shown (`open`; by default while its edge is selected).
 * Presses and the wheel over it are left to it. It holds only what the app writes (its buttons).
 */
@Directive({ selector: "[flowEdgeToolbar]", exportAs: "flowEdgeToolbar" })
export class FlowEdgeToolbarDirective {
    /** its edge; default the enclosing `[flowEdge]`'s */
    readonly edgeId = input<string | undefined>(undefined);
    /** the point of the edge it stands at: its label point, its source or its target end; default `"label"` */
    readonly position = input<"label" | "source" | "target" | undefined>(
        undefined,
    );
    /** a flow point it stands at instead (absolute flow coordinates); wins over `position` */
    readonly point = input<XY | undefined>(undefined);
    /** a screen offset from that point, in pixels; default `{ x: 0, y: 0 }` */
    readonly offset = input<XY | undefined>(undefined);
    /** which of its edges goes at the point across: its left (`"start"`), centre (default) or right */
    readonly alignX = input<"start" | "center" | "end" | undefined>(undefined);
    /** which of its edges goes at the point down: its top (`"start"`), centre (default) or bottom */
    readonly alignY = input<"start" | "center" | "end" | undefined>(undefined);
    /** whether it is shown; default while its edge is selected (`selection()`) */
    readonly open = input(undefined, { transform: optionalBoolean });

    private readonly context = injectFlowContext("[flowEdgeToolbar]");
    private readonly id = partOwnerId(
        "[flowEdgeToolbar]",
        this.edgeId,
        injectEdgeContext(),
        "edge",
    );
    private readonly view = flowValue(
        this.context,
        (): ToolbarView | undefined => {
            const engine = this.context.engine();
            const edgeId = this.id();
            if (!engine || edgeId === undefined) return undefined;
            // hidden, it reads nothing of the view: a pan or a zoom gives the same value (nothing
            // is checked again); shown, an equal anchor keeps the last value
            const shown =
                this.open() ??
                this.context.model().is("edge-selected", { edgeId });
            if (!shown) return undefined;
            const anchor = engine.get("edge-toolbar-by", {
                edgeId,
                position: this.position() ?? "label",
                point: this.point(),
                offset: this.offset(),
                alignX: this.alignX(),
                alignY: this.alignY(),
            });
            return anchor
                ? {
                      anchor,
                      attributes: engine.adapter.attributes("toolbar", {
                          edgeId,
                      }),
                  }
                : undefined;
        },
    );

    /** the toolbar's state (`null` while it is not shown) */
    readonly state: Signal<EdgeToolbarState | null> = computed(() => {
        const view = this.view();
        const edgeId = this.id();
        if (!view || edgeId === undefined) return null;
        return {
            edgeId,
            position: this.position() ?? "label",
            anchor: view.anchor,
        };
    });

    constructor() {
        const host = injectHost();
        bindAttributes(host, () => this.view()?.attributes ?? {});
        bindStructuralStyle(host, () => {
            const anchor = this.view()?.anchor;
            return {
                position: "absolute",
                top: 0,
                left: 0,
                transform: anchor
                    ? `translate(${anchor.x}px, ${anchor.y}px) translate(${-anchor.anchorX * 100}%, ${-anchor.anchorY * 100}%)`
                    : undefined,
            };
        });
        bindPresence(host, () =>
            this.state() ? this.context.rootElement : null,
        );
    }
}
