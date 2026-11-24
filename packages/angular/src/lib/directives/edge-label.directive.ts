import { computed, Directive, inject, input, type Signal } from "@angular/core";
import type { EdgePath } from "@fragiola/flow";
import {
    FLOW_EDGE_LABEL_LAYER,
    injectEdgeContext,
    injectFlowContext,
} from "../context";
import { edgePathOf, staticEdgeAttributes } from "../inject/inject-edge";
import { entityOf, flowValue, partOwnerId } from "../inject/internal";
import {
    bindAttributes,
    bindStructuralStyle,
    injectHost,
} from "../utils/helpers";
import { bindPresence } from "../utils/presence";

export interface EdgeLabelState {
    readonly edgeId: string;
    /** the edge's path, label point and ends */
    readonly path: EdgePath;
    /** `data-selected` (`selection()`) */
    readonly selected: boolean;
}

/**
 * An edge's label (`data-flow-part="edge-label"`): the app's HTML element, written inside
 * `[flowEdge]` with the `xhtml:` prefix (`<xhtml:div flowEdgeLabel>`: the edge is SVG, the label
 * HTML) and moved into the HTML layer of `[flowEdges]` (SVG holds no HTML; with several render
 * levels, its edge's level wrapper), centred on the path's
 * label point in flow coordinates. It holds only what the app writes; a press on it selects its
 * edge. It is out of the document while its edge has no path.
 */
@Directive({ selector: "[flowEdgeLabel]", exportAs: "flowEdgeLabel" })
export class FlowEdgeLabelDirective {
    /** the edge; default the enclosing `[flowEdge]`'s */
    readonly edgeId = input<string | undefined>(undefined);

    private readonly context = injectFlowContext("[flowEdgeLabel]");
    private readonly id = partOwnerId(
        "[flowEdgeLabel]",
        this.edgeId,
        injectEdgeContext(),
        "edge",
    );
    private readonly path = edgePathOf(this.context, this.id);
    private readonly attributes = flowValue(
        this.context,
        () => {
            const edgeId = this.id();
            if (edgeId === undefined) return undefined;
            const engine = this.context.engine();
            return engine
                ? engine.adapter.attributes("edge-label", { edgeId })
                : staticEdgeAttributes(this.context, "edge-label", edgeId);
        },
        undefined,
        {
            scope: "entity",
            entity: entityOf("edge", () => this.id()),
        },
    );

    /** the label's state (`undefined` while its edge has no path) */
    readonly state: Signal<EdgeLabelState | undefined> = computed(() => {
        const edgeId = this.id();
        const path = this.path();
        const attributes = this.attributes();
        if (edgeId === undefined || !path || !attributes) return undefined;
        return {
            edgeId,
            path,
            selected: attributes["data-selected"] !== undefined,
        };
    });

    constructor() {
        const host = injectHost();
        const layers = inject(FLOW_EDGE_LABEL_LAYER, { optional: true });
        bindAttributes(host, () => this.attributes() ?? {});
        bindStructuralStyle(host, () => {
            const label = this.path()?.label;
            return {
                position: "absolute",
                top: 0,
                left: 0,
                transform: label
                    ? `translate(${label.x}px, ${label.y}px) translate(-50%, -50%)`
                    : undefined,
                pointerEvents: "all",
            };
        });
        // into the HTML layer of its edge's level
        bindPresence(host, () => {
            const state = this.state();
            return state && layers ? layers.of(state.edgeId) : null;
        });
    }
}
