import type { Connection } from "@fragiola/flow";
import { h } from "vue";
import { useFlowValue } from "../composables/internal";
import { useConnection } from "../composables/use-connection";
import { useFlowContext } from "../context";
import {
    definePrimitive,
    type FlowComponent,
    type PrimitiveProps,
    type SlotFunction,
} from "../utils/primitive";
import { type RenderSlot, renderElement } from "../utils/render";

export interface ConnectionLineState {
    /** the connection being drawn */
    readonly connection: Connection;
    /** the drop would add the edge: `data-valid` */
    readonly valid: boolean;
    /** the drop would be refused (`model.can("edge.add")`, a middleware's veto): `data-invalid` */
    readonly invalid: boolean;
}

export interface ConnectionLineProps extends PrimitiveProps {}

export interface ConnectionLineSlots extends RenderSlot<ConnectionLineState> {
    /**
     * draws the line, in flow coordinates (`v-slot="{ connection }"`); default an unfilled
     * `<path>` of the connection's path (`data-flow-part="connection-path"`)
     */
    default?: SlotFunction<{ connection: Connection }>;
}

const LINE_STYLE = {
    position: "absolute",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    overflow: "visible",
    pointerEvents: "none",
};

/**
 * The connection being drawn (`data-flow-part="connection-line"`, `data-valid` / `data-invalid`,
 * `connection()`): an SVG inside `Flow.Viewport`, rendered only while a connection is under way.
 */
export const ConnectionLine: FlowComponent<
    ConnectionLineProps,
    ConnectionLineSlots
> = definePrimitive<ConnectionLineProps, ConnectionLineSlots>(
    "ConnectionLine",
    ["as"],
    (props, { attrs, slots }) => {
        const context = useFlowContext("ConnectionLine");
        const connection = useConnection();
        const attributes = useFlowValue(
            context,
            () =>
                context.engine.value?.adapter.attributes("connection-line") ??
                {},
        );
        return () => {
            const current = connection.value;
            if (!current) return null;
            const own = attributes.value;
            const state: ConnectionLineState = {
                connection: current,
                valid: own["data-valid"] !== undefined,
                invalid: own["data-invalid"] !== undefined,
            };
            return renderElement({
                tag: "svg",
                as: props.as,
                attrs,
                render: slots.render,
                state,
                props: { ...own, "data-flow-part": "connection-line" },
                style: LINE_STYLE,
                children: () =>
                    slots.default
                        ? slots.default({ connection: current })
                        : h("path", {
                              "data-flow-part": "connection-path",
                              d: current.path,
                              fill: "none",
                          }),
            });
        };
    },
);
