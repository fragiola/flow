import { computed, Directive, type Signal } from "@angular/core";
import { injectFlowContext } from "../context";
import { flowValue } from "../inject/internal";
import {
    bindAttributes,
    bindBaseAttributes,
    injectHost,
} from "../utils/helpers";

/** The switches the lock turns off and on (React Flow's: dragging, connecting, selecting). */
const LOCKED_KINDS = ["drag", "connect", "select"] as const;

export interface ToggleInteractiveState {
    /**
     * the flow is not locked: it is interactive and one of dragging, connecting and selecting at
     * least is on (`interactive-by`)
     */
    readonly interactive: boolean;
}

/**
 * A toggle button (`data-flow-part="toggle-interactive"`, `aria-pressed` while the flow is locked,
 * `data-interactive`), on the app's `<button flowToggleInteractive>`: locks and unlocks the flow,
 * React Flow's interactive button: locking turns dragging, connecting and selecting off
 * (`set-interactive { drag, connect, select }`), unlocking turns them and `interactive` on; pan
 * and zoom stay. It holds only what the app writes; `type="button"` unless the app sets one.
 */
@Directive({
    selector: "[flowToggleInteractive]",
    exportAs: "flowToggleInteractive",
    host: { "(click)": "toggle()" },
})
export class FlowToggleInteractiveDirective {
    private readonly context = injectFlowContext("[flowToggleInteractive]");
    private readonly interactive = flowValue(this.context, () => {
        const engine = this.context.engine();
        return engine
            ? LOCKED_KINDS.some((kind) => engine.is("interactive-by", { kind }))
            : true;
    });

    /** the toggle's state (`#t="flowToggleInteractive"`, then `t.state().interactive`) */
    readonly state: Signal<ToggleInteractiveState> = computed(() => ({
        interactive: this.interactive(),
    }));

    constructor() {
        bindAttributes(injectHost(), () => {
            const interactive = this.interactive();
            return {
                "data-flow-part": "toggle-interactive",
                "data-interactive": interactive ? "" : undefined,
                "aria-pressed": String(!interactive),
                disabled: this.context.engine() ? undefined : "",
            };
        });
        bindBaseAttributes(injectHost(), () => ({ type: "button" }));
    }

    /** @internal locks or unlocks the flow, before the app's `(click)` */
    protected toggle(): void {
        this.context.engine()?.run(
            "set-interactive",
            this.interactive()
                ? { drag: false, connect: false, select: false }
                : {
                      interactive: true,
                      drag: true,
                      connect: true,
                      select: true,
                  },
        );
    }
}
