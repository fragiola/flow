import type { Signal } from "@angular/core";
import type { Connection } from "@fragiola/flow";
import { injectFlowContext } from "../context";
import { flowValue } from "./internal";

/** Two connections that draw and report the same. */
export function sameConnection(
    a: Connection | null,
    b: Connection | null,
): boolean {
    return (
        a === b ||
        (a !== null &&
            b !== null &&
            a.path === b.path &&
            a.status === b.status &&
            a.to === b.to &&
            a.from === b.from &&
            a.toSide === b.toSide)
    );
}

/**
 * The connection being drawn from a handle (`connection()`), or null, as a signal that changes
 * with it: where it starts and ends, the handle it would end at and whether the drop would be
 * accepted (`status`). Call it in an injection context.
 */
export function injectConnection(): Signal<Connection | null> {
    const context = injectFlowContext("injectConnection");
    return flowValue(
        context,
        () => context.engine()?.get("connection") ?? null,
        sameConnection,
    );
}
