import { Directive, input, type Signal } from "@angular/core";
import {
    type ControlButtonState,
    controlButton,
} from "../inject/control-button";
import { optionalBoolean } from "../utils/helpers";

/**
 * A button (`data-flow-part="zoom-out"`), on the app's `<button flowZoomOut>`: zooms out by a step
 * around the root's centre (`zoom-out`), disabled at the least zoom. It holds only what the app
 * writes (an icon, a label); `type="button"` unless the app sets one.
 */
@Directive({
    selector: "[flowZoomOut]",
    exportAs: "flowZoomOut",
    host: { "(click)": "click()" },
})
export class FlowZoomOutDirective {
    /** disabled whatever the engine says */
    readonly disabled = input(undefined, { transform: optionalBoolean });

    private readonly button = controlButton(
        "zoom-out",
        "zoom-out",
        this.disabled,
    );

    /** the button's state (`#b="flowZoomOut"`, then `b.state().disabled`) */
    readonly state: Signal<ControlButtonState> = this.button.state;

    /** @internal its action, before the app's `(click)` */
    protected click(): void {
        if (!this.state().disabled) this.button.click();
    }
}
