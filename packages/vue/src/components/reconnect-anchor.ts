import type { EdgePath } from "@fragiola/flow";
import { useFlowValue } from "../composables/internal";
import { useEdgePath } from "../composables/use-edge";
import { useEdgeId, useFlowContext } from "../context";
import {
    definePrimitive,
    type FlowComponent,
    type PrimitiveProps,
} from "../utils/primitive";
import { type RenderSlot, renderElement } from "../utils/render";

export interface ReconnectAnchorState {
    readonly edgeId: string;
    /** which end of the edge it moves */
    readonly end: "source" | "target";
    /** the edge's path and ends */
    readonly path: EdgePath;
    /** this edge's end is being moved */
    readonly reconnecting: boolean;
}

export interface ReconnectAnchorProps extends PrimitiveProps {
    /** which end of the edge it moves */
    end: "source" | "target";
    /** the edge; default the enclosing `Flow.Edge`'s */
    edgeId?: string | undefined;
}

export interface ReconnectAnchorSlots
    extends RenderSlot<ReconnectAnchorState> {}

/**
 * An edge end's grab area (`data-flow-part="reconnect-anchor"`, `data-end`): an SVG circle at the
 * end, inside `Flow.Edge`. With `reconnection()`, a press on it moves that end to another handle.
 * Transparent by default; give it its radius (`r`, default 10) and look.
 */
export const ReconnectAnchor: FlowComponent<
    ReconnectAnchorProps,
    ReconnectAnchorSlots
> = definePrimitive<ReconnectAnchorProps, ReconnectAnchorSlots>(
    "ReconnectAnchor",
    ["end", "edgeId", "as"],
    (props, { attrs, slots }) => {
        const context = useFlowContext("ReconnectAnchor");
        const edgeId = useEdgeId("ReconnectAnchor", () => props.edgeId);
        const path = useEdgePath(context, edgeId);
        const view = useFlowValue(context, () => {
            const engine = context.engine.value;
            const id = edgeId();
            return engine
                ? {
                      attributes: engine.adapter.attributes(
                          "reconnect-anchor",
                          {
                              edgeId: id,
                              end: props.end,
                          },
                      ),
                      reconnecting: engine.is("edge-reconnecting", {
                          edgeId: id,
                      }),
                  }
                : undefined;
        });
        return () => {
            const current = path.value;
            const own = view.value;
            if (!current || !own) return null;
            const point = current[props.end];
            return renderElement({
                tag: "circle",
                as: props.as,
                attrs,
                render: slots.render,
                state: {
                    edgeId: edgeId(),
                    end: props.end,
                    path: current,
                    reconnecting: own.reconnecting,
                },
                props: {
                    ...own.attributes,
                    cx: point.x,
                    cy: point.y,
                    r: 10,
                    fill: "transparent",
                },
                style: { pointerEvents: "all" },
            });
        };
    },
);
