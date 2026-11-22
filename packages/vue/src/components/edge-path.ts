import type { EdgePath as EdgePathValue } from "@fragiola/flow";
import { useFlowValue } from "../composables/internal";
import { edgeAttributes, useEdgePath } from "../composables/use-edge";
import { useEdgeId, useFlowContext } from "../context";
import {
    definePrimitive,
    type FlowComponent,
    type PrimitiveProps,
} from "../utils/primitive";
import { type RenderSlot, renderElement } from "../utils/render";

export interface EdgePathState {
    readonly edgeId: string;
    /** the edge's path, label point and ends */
    readonly path: EdgePathValue;
    /** `data-selected` (`selection()`) */
    readonly selected: boolean;
}

export interface EdgePathProps extends PrimitiveProps {
    /** the edge; default the enclosing `Flow.Edge`'s */
    edgeId?: string | undefined;
}

export interface EdgePathSlots extends RenderSlot<EdgePathState> {}

/**
 * An edge's path (`data-flow-part="edge-path"`): an SVG `<path>` whose `d` is the engine's
 * (`edge-path-by`, D9; before the engine exists, the static geometry's), unfilled. A `d` of your own draws an app type (from `state.path`'s ends).
 * Several may share an edge: a wide transparent one is a bigger press target.
 */
export const EdgePath: FlowComponent<EdgePathProps, EdgePathSlots> =
    definePrimitive<EdgePathProps, EdgePathSlots>(
        "EdgePath",
        ["edgeId", "as"],
        (props, { attrs, slots }) => {
            const context = useFlowContext("EdgePath");
            const edgeId = useEdgeId("EdgePath", () => props.edgeId);
            const path = useEdgePath(context, edgeId);
            const attributes = useFlowValue(context, () =>
                edgeAttributes(context, "edge-path", edgeId()),
            );
            return () => {
                const current = path.value;
                const own = attributes.value;
                if (!current || !own) return null;
                return renderElement({
                    tag: "path",
                    as: props.as,
                    attrs,
                    render: slots.render,
                    state: {
                        edgeId: edgeId(),
                        path: current,
                        selected: own["data-selected"] !== undefined,
                    },
                    props: { ...own, d: current.path, fill: "none" },
                });
            };
        },
    );
