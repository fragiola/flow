import type { Connection } from "@fragiola/flow";
import { useFlowContext } from "../context";
import { useFlowValue } from "./internal";

/**
 * The connection being drawn from a handle (`connection()`), or null, re-rendering the component
 * when it changes: where it starts and ends, the handle it would end at and whether the drop
 * would be accepted (`status`).
 */
export function useConnection(): Connection | null {
    const { model, engine } = useFlowContext("useConnection");
    return useFlowValue(
        model,
        engine,
        () => engine?.get("connection") ?? null,
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
