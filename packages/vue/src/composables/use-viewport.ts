import type { Viewport } from "@fragiola/flow";
import type { ComputedRef } from "vue";
import { useFlowContext } from "../context";
import { useFlowValue } from "./internal";

/**
 * The viewport of the enclosing `Flow.Root` (`{ x, y, zoom }`), as a computed ref that changes
 * with it: a zoom level readout, a control's state. Change it with `engine.run("set-viewport")`.
 */
export function useViewport(): ComputedRef<Viewport> {
    const context = useFlowContext("useViewport");
    return useFlowValue(context, () => context.publicEngine.get("viewport"));
}
