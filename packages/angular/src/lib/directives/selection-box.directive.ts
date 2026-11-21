import { computed, Directive, type Signal } from "@angular/core";
import type { Rect } from "@fragiola/flow";
import { injectFlowContext } from "../context";
import { flowValue } from "../inject/internal";
import {
    bindAttributes,
    bindStructuralStyle,
    injectHost,
    px,
} from "../utils/helpers";
import { bindPresence } from "../utils/presence";

export interface SelectionBoxState {
    /** the box, in pixels relative to the root */
    readonly box: Rect;
}

/**
 * The box selection being drawn (`data-flow-part="selection-box"`, `selection()`), on the app's
 * element: `<div flowSelectionBox>`, absolutely positioned in `[flowRoot]` (outside
 * `[flowViewport]`: it is in screen pixels). It is in the document only while a box is drawn.
 * Give it its look.
 */
@Directive({ selector: "[flowSelectionBox]", exportAs: "flowSelectionBox" })
export class FlowSelectionBoxDirective {
    private readonly context = injectFlowContext("[flowSelectionBox]");
    private readonly box = flowValue(
        this.context,
        () => this.context.engine()?.get("selection-box") ?? null,
    );
    private readonly attributes = flowValue(
        this.context,
        () => this.context.engine()?.adapter.attributes("selection-box") ?? {},
    );

    /** the box's state (`null` while no box is drawn) */
    readonly state: Signal<SelectionBoxState | null> = computed(() => {
        const box = this.box();
        return box ? { box } : null;
    });

    constructor() {
        const host = injectHost();
        bindAttributes(host, () => ({
            ...this.attributes(),
            "data-flow-part": "selection-box",
        }));
        bindStructuralStyle(host, () => {
            const box = this.box();
            return {
                position: "absolute",
                left: px(box?.x),
                top: px(box?.y),
                width: px(box?.width),
                height: px(box?.height),
                pointerEvents: "none",
            };
        });
        bindPresence(host, () => (this.box() ? "here" : null));
    }
}
