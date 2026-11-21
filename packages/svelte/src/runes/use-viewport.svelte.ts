import type { Viewport } from "@fragiola/flow";
import { useFlowContext } from "../context.js";
import { type FlowValue, flowValue } from "./internal.svelte.js";

/**
 * The viewport of the enclosing `Flow.Root` (`{ x, y, zoom }`) as `current`, which follows it: a
 * zoom level readout, a control's state. Change it with `engine.run("set-viewport")`.
 */
export function useViewport(): FlowValue<Viewport> {
    const context = useFlowContext("useViewport");
    return flowValue(context, () => context.publicEngine.get("viewport"));
}
