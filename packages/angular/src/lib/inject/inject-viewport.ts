import type { Signal } from "@angular/core";
import type { Viewport } from "@fragiola/flow";
import { injectFlowContext } from "../context";
import { flowValue } from "./internal";

/**
 * The viewport of the enclosing `[flowRoot]` (`{ x, y, zoom }`), as a signal that changes with it:
 * a zoom level readout, a control's state. Change it with `engine.run("set-viewport")`. Call it in
 * an injection context (a constructor or a field initializer).
 */
export function injectViewport(): Signal<Viewport> {
    const context = injectFlowContext("injectViewport");
    return flowValue(context, () => context.publicEngine.get("viewport"));
}
