import type { Connection } from "@fragiola/flow";
import type * as React from "react";
import { useFlowContext } from "../context";
import { useFlowValue } from "../hooks/internal";
import { useConnection } from "../hooks/use-connection";
import { type SvgPrimitiveProps, useRenderElement } from "../utils/use-render";

export interface ConnectionLineState {
    /** the connection being drawn */
    readonly connection: Connection;
    /** the drop would add the edge: `data-valid` */
    readonly valid: boolean;
    /** the drop would be refused (`model.can("edge.add")`, a middleware's veto): `data-invalid` */
    readonly invalid: boolean;
}

export interface ConnectionLineProps
    extends Omit<
        SvgPrimitiveProps<ConnectionLineState, SVGSVGElement>,
        "children"
    > {
    /**
     * draws the line, in flow coordinates; default an unfilled `<path>` of the connection's path
     * (`data-flow-part="connection-path"`)
     */
    children?: ((connection: Connection) => React.ReactNode) | undefined;
}

const LINE_STYLE: React.CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    overflow: "visible",
    pointerEvents: "none",
};

/**
 * The connection being drawn (`data-flow-part="connection-line"`, `data-valid` / `data-invalid`,
 * `connection()`): an SVG inside `Flow.Viewport`, rendered only while a connection is under way.
 */
export function ConnectionLine(props: ConnectionLineProps) {
    const connection = useConnection();
    if (!connection) return null;
    return <ConnectionLineElement {...props} connection={connection} />;
}

function ConnectionLineElement(
    props: ConnectionLineProps & { connection: Connection },
) {
    const { connection, children, ...rest } = props;
    const { model, engine } = useFlowContext("ConnectionLine");
    const attributes = useFlowValue(
        model,
        engine,
        () => engine?.adapter.attributes("connection-line") ?? {},
    );
    const state: ConnectionLineState = {
        connection,
        valid: attributes["data-valid"] !== undefined,
        invalid: attributes["data-invalid"] !== undefined,
    };
    return useRenderElement("svg", rest, {
        state,
        props: {
            ...attributes,
            "data-flow-part": "connection-line",
            children: children ? (
                children(connection)
            ) : (
                <path
                    data-flow-part="connection-path"
                    d={connection.path}
                    fill="none"
                />
            ),
        },
        style: LINE_STYLE,
    });
}
