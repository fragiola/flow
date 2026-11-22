import { Directive, input, type Signal } from "@angular/core";
import type { FitPadding } from "@fragiola/flow";
import {
    type ControlButtonState,
    controlButton,
    givenPayload,
} from "../inject/control-button";
import { optionalBoolean, optionalNumber } from "../utils/helpers";

/**
 * A button (`data-flow-part="fit-view"`), on the app's `<button flowFitView>`: fits every node in
 * the root, or its `nodeIds` (`fit-view`, with its inputs as the payload), disabled before a node
 * is measured. It holds only what the app writes (an icon, a label); `type="button"` unless the
 * app sets one.
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
    /**
     * the room kept free on every side: a share of the root's size, `"<n>px"`, or each side's
     * (`{ top, right, bottom, left }`); default the engine's 0.1
     */
    readonly padding = input<FitPadding | undefined>(undefined);
    /** only these nodes; default every node that is not hidden */
    readonly nodeIds = input<string[] | undefined>(undefined);
    /** without `nodeIds`, the hidden nodes of known size too; default false */
    readonly includeHidden = input(undefined, { transform: optionalBoolean });
    /** the least zoom it may pick (within the root's limits); default the root's `minZoom` */
    readonly minZoom = input(undefined, { transform: optionalNumber });
    /** the greatest zoom it may pick (within the root's limits); default the root's `maxZoom` */
    readonly maxZoom = input(undefined, { transform: optionalNumber });

    private readonly button = controlButton(
        "fit-view",
        "fit-view",
        this.disabled,
        () =>
            givenPayload({
                duration: this.duration(),
                padding: this.padding(),
                nodeIds: this.nodeIds(),
                includeHidden: this.includeHidden(),
                minZoom: this.minZoom(),
                maxZoom: this.maxZoom(),
            }),
    );

    /** the button's state (`#b="flowFitView"`, then `b.state().disabled`) */
    readonly state: Signal<ControlButtonState> = this.button.state;

    /** @internal its action, before the app's `(click)` */
    protected click(): void {
        if (!this.state().disabled) this.button.click();
    }
}
