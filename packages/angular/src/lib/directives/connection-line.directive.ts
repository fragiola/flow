import { computed, Directive, type Signal } from "@angular/core";
import type { Connection } from "@fragiola/flow";
import { injectFlowContext } from "../context";
import { injectConnection } from "../inject/inject-connection";
import { flowValue } from "../inject/internal";
import { defaultContent } from "../utils/default-content";
import {
    bindAttributes,
    bindBaseAttributes,
    bindStructuralStyle,
    injectHost,
} from "../utils/helpers";
import { bindPresence } from "../utils/presence";

export interface ConnectionLineState {
    /** the connection being drawn */
    readonly connection: Connection;
    /** the drop would add the edge: `data-valid` */
    readonly valid: boolean;
    /** the drop would be refused (`model.can("edge.add")`, a middleware's veto): `data-invalid` */
    readonly invalid: boolean;
}

const SVG = "http://www.w3.org/2000/svg";

/**
 * The connection being drawn (`data-flow-part="connection-line"`, `data-valid` / `data-invalid`,
 * `connection()`), on the app's `<svg flowConnectionLine>` inside `[flowViewport]`: in the
 * document only while a connection is under way. It draws what the app writes inside it in flow
 * coordinates (`#line="flowConnectionLine"`, then `line.state()?.connection.path`), or, when the
 * app writes no element, an unfilled path of the connection (`data-flow-part="connection-path"`).
 */
@Directive({
    selector: "[flowConnectionLine]",
    exportAs: "flowConnectionLine",
})
export class FlowConnectionLineDirective {
    private readonly context = injectFlowContext("[flowConnectionLine]");
    private readonly connection = injectConnection();
    private readonly attributes = flowValue(
        this.context,
        () =>
            this.context.engine()?.adapter.attributes("connection-line") ?? {},
    );

    /** the line's state (`null` while no connection is drawn) */
    readonly state: Signal<ConnectionLineState | null> = computed(() => {
        const connection = this.connection();
        if (!connection) return null;
        const attributes = this.attributes();
        return {
            connection,
            valid: attributes["data-valid"] !== undefined,
            invalid: attributes["data-invalid"] !== undefined,
        };
    });

    constructor() {
        const host = injectHost<SVGSVGElement>();
        bindAttributes(host, () => ({
            ...this.attributes(),
            "data-flow-part": "connection-line",
        }));
        bindStructuralStyle(host, () => ({
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            overflow: "visible",
            pointerEvents: "none",
        }));
        bindPresence(host, () => (this.connection() ? "here" : null));
        // React's default child: the connection's path
        defaultContent(host, (document) => {
            const path = document.createElementNS(SVG, "path");
            path.setAttribute("data-flow-part", "connection-path");
            bindBaseAttributes(path, () => ({
                d: this.connection()?.path,
                fill: "none",
            }));
            return [path];
        });
    }
}
