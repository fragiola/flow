import { Directive, type Signal, signal } from "@angular/core";
import { partAttributes } from "@fragiola/flow";
import { bindAttributes, injectHost } from "../utils/helpers";

/** The state of `[flowControls]` (none: its buttons have their own). */
export type ControlsState = Record<never, never>;

const ATTRIBUTES = partAttributes("controls");

/**
 * A group of the viewport's buttons (`data-flow-part="controls"`), on the app's element:
 * `<div flowControls>` holding `[flowZoomIn]`, `[flowZoomOut]`, `[flowFitView]`,
 * `[flowToggleInteractive]` or the app's own. Inside `[flowRoot]`, outside `[flowViewport]`;
 * presses and the wheel over it are left to it. Place it with your style.
 */
@Directive({ selector: "[flowControls]", exportAs: "flowControls" })
export class FlowControlsDirective {
    /** its state: none (its buttons have their own) */
    readonly state: Signal<ControlsState> = signal({}).asReadonly();

    constructor() {
        bindAttributes(injectHost(), () => ATTRIBUTES);
    }
}
