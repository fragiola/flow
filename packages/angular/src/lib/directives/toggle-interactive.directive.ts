import { computed, Directive, type Signal } from "@angular/core";
import { injectFlowContext } from "../context";
import { flowValue } from "../inject/internal";
import {
    bindAttributes,
    bindBaseAttributes,
    injectHost,
} from "../utils/helpers";

export interface ToggleInteractiveState {
    /** the gestures and keys may change the flow */
    readonly interactive: boolean;
}

/**
 * A toggle button (`data-flow-part="toggle-interactive"`, `aria-pressed` while the flow is locked,
 * `data-interactive`), on the app's `<button flowToggleInteractive>`: locks and unlocks the flow
 * (`set-interactive`): while locked, gestures and keys change nothing, pan and zoom stay. It holds
 * only what the app writes; `type="button"` unless the app sets one.
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
        return engine ? engine.is("interactive") : true;
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
        this.context
            .engine()
            ?.run("set-interactive", { interactive: !this.interactive() });
    }
}
