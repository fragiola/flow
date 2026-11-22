import { Directive, input, type Signal } from "@angular/core";
import {
    type ControlButtonState,
    controlButton,
} from "../inject/control-button";
import { optionalBoolean, optionalNumber } from "../utils/helpers";

/**
 * A button (`data-flow-part="fit-view"`), on the app's `<button flowFitView>`: fits every node in
 * the root (`fit-view`), disabled before a node is measured. It holds only what the app writes (an
 * icon, a label); `type="button"` unless the app sets one.
 */
@Directive({
    selector: "[flowFitView]",
    exportAs: "flowFitView",
    host: { "(click)": "click()" },
})
export class FlowFitViewDirective {
    /** disabled whatever the engine says */
    readonly disabled = input(undefined, { transform: optionalBoolean });
    /** how long its viewport change animates, in milliseconds (the root's `easing`); default 0: at once */
    readonly duration = input(undefined, { transform: optionalNumber });

    private readonly button = controlButton(
        "fit-view",
        "fit-view",
        this.disabled,
        this.duration,
    );

    /** the button's state (`#b="flowFitView"`, then `b.state().disabled`) */
    readonly state: Signal<ControlButtonState> = this.button.state;

    /** @internal its action, before the app's `(click)` */
    protected click(): void {
        if (!this.state().disabled) this.button.click();
    }
}
