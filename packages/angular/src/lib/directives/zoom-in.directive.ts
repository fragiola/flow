import { Directive, input, type Signal } from "@angular/core";
import {
    type ControlButtonState,
    controlButton,
} from "../inject/control-button";
import { optionalBoolean, optionalNumber } from "../utils/helpers";

/**
 * A button (`data-flow-part="zoom-in"`), on the app's `<button flowZoomIn>`: zooms in by a step
 * around the root's centre (`zoom-in`), disabled at the greatest zoom. It holds only what the app
 * writes (an icon, a label); `type="button"` unless the app sets one.
 */
@Directive({
    selector: "[flowZoomIn]",
    exportAs: "flowZoomIn",
    host: { "(click)": "click()" },
})
export class FlowZoomInDirective {
    /** disabled whatever the engine says */
    readonly disabled = input(undefined, { transform: optionalBoolean });
    /** how long its viewport change animates, in milliseconds (the root's `easing`); default 0: at once */
    readonly duration = input(undefined, { transform: optionalNumber });

    private readonly button = controlButton(
        "zoom-in",
        "zoom-in",
        this.disabled,
        this.duration,
    );

    /** the button's state (`#b="flowZoomIn"`, then `b.state().disabled`) */
    readonly state: Signal<ControlButtonState> = this.button.state;

    /** @internal its action, before the app's `(click)` */
    protected click(): void {
        if (!this.state().disabled) this.button.click();
    }
}
