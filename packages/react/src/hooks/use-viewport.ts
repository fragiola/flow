import type { Viewport } from "@fragiola/flow";
import { useFlowContext } from "../context";
import { useFlowValue } from "./internal";

/**
 * The viewport of the enclosing `Flow.Root` (`{ x, y, zoom }`), re-rendering the component when it
 * changes: a zoom level readout, a control's state. Change it with `engine.run("set-viewport")`.
 */
export function useViewport(): Viewport {
    const { model, engine, publicEngine } = useFlowContext("useViewport");
    return useFlowValue(model, engine, () => publicEngine.get("viewport"));
}
