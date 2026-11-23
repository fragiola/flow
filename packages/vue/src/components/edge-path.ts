import type { EdgePath as EdgePathValue } from "@fragiola/flow";
import { sameValue, useFlowValue } from "../composables/internal";
import { edgeAttributes, useEdgePath } from "../composables/use-edge";
import { useEdgeId, useFlowContext } from "../context";
import {
    definePrimitive,
    type FlowComponent,
    type PrimitiveProps,
    type SlotFunction,
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

export interface EdgePathSlots extends RenderSlot<EdgePathState> {
    /** the path's SVG content (an `<animate>`, a `<title>`), as React's children */
    default?: SlotFunction<{ state: EdgePathState }>;
}

/**
 * An edge's path (`data-flow-part="edge-path"`): an SVG `<path>` whose `d` is the engine's
 * (`edge-path-by`, D9; before the engine exists, the static geometry's), unfilled. A `d` of your own draws an app type (from `state.path`'s ends).
 * Several may share an edge: a wide transparent one is a bigger press target. Its default slot
 * renders inside the `<path>` (an `<animate>`, a `<title>`), as React's children.
 */
export const EdgePath: FlowComponent<EdgePathProps, EdgePathSlots> =
    definePrimitive<EdgePathProps, EdgePathSlots>(
        "EdgePath",
        ["edgeId", "as"],
        (props, { attrs, slots }) => {
            const context = useFlowContext("EdgePath");
            const edgeId = useEdgeId("EdgePath", () => props.edgeId);
            const path = useEdgePath(context, edgeId);
            const attributes = useFlowValue(
                context,
                () => edgeAttributes(context, "edge-path", edgeId()),
                sameValue,
                "entity",
                () => ({ kind: "edge", id: edgeId() }),
            );
            return () => {
                const current = path.value;
                const own = attributes.value;
                if (!current || !own) return null;
                const state: EdgePathState = {
                    edgeId: edgeId(),
                    path: current,
                    selected: own["data-selected"] !== undefined,
                };
                return renderElement({
                    tag: "path",
                    as: props.as,
                    attrs,
                    render: slots.render,
                    state,
                    props: { ...own, d: current.path, fill: "none" },
                    children: slots.default
                        ? () => slots.default?.({ state })
                        : undefined,
                });
            };
        },
    );
