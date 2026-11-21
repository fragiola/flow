import type { Connection } from "@fragiola/flow";
import { useFlowContext } from "../context.js";
import { type FlowValue, flowValue } from "./internal.svelte.js";

/**
 * The connection being drawn from a handle (`connection()`), or null, as `current`, which follows
 * it: where it starts and ends, the handle it would end at and whether the drop would be accepted
 * (`status`).
 */
export function useConnection(): FlowValue<Connection | null> {
    const context = useFlowContext("useConnection");
    return flowValue(
        context,
        () => context.engine?.get("connection") ?? null,
        (a, b) =>
            a === b ||
            (a !== null &&
                b !== null &&
                a.path === b.path &&
                a.status === b.status &&
                a.to === b.to &&
                a.from === b.from &&
                a.toSide === b.toSide),
    );
}
