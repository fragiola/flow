import type { Connection } from "@fragiola/flow";
import type { ComputedRef } from "vue";
import { useFlowContext } from "../context";
import { useFlowValue } from "./internal";

/**
 * The connection being drawn from a handle (`connection()`), or null, as a computed ref that
 * changes with it: where it starts and ends, the handle it would end at and whether the drop would
 * be accepted (`status`).
 */
export function useConnection(): ComputedRef<Connection | null> {
    const context = useFlowContext("useConnection");
    return useFlowValue(
        context,
        () => context.engine.value?.get("connection") ?? null,
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
