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

export interface NodesSelectionState {
    /** the rectangle around the selected nodes, in flow coordinates */
    readonly rect: Rect;
    /** the selection is being dragged by it: `data-dragging` */
    readonly dragging: boolean;
}

/**
 * The rectangle around the selected nodes (`data-flow-part="nodes-selection"`, `selection()`), on
 * the app's element: `<div flowNodesSelection>` inside `[flowViewport]`, after `[flowNodes]` (it
 * is in flow coordinates). It is in the document only at `selection-rect`: while two or more nodes
 * are selected by a box (or always, with `selection({ rect: "always" })`). A press on it drags the
 * selection (`drag()`), its context menu is the selection's. With `keyboard()` it takes focus
 * (`tabindex`), and its keys are a focused selected node's: the arrows move the selection, the
 * delete keys remove it, Escape clears it. Give it its look.
 */
@Directive({ selector: "[flowNodesSelection]", exportAs: "flowNodesSelection" })
export class FlowNodesSelectionDirective {
    private readonly context = injectFlowContext("[flowNodesSelection]");
    private readonly rect = flowValue(
        this.context,
        () => this.context.engine()?.get("selection-rect") ?? null,
    );
    private readonly attributes = flowValue(
        this.context,
        () =>
            this.context.engine()?.adapter.attributes("nodes-selection") ?? {},
    );

    /** the rectangle's state (`null` while it is not shown) */
    readonly state: Signal<NodesSelectionState | null> = computed(() => {
        const rect = this.rect();
        return rect
            ? {
                  rect,
                  dragging: this.attributes()["data-dragging"] !== undefined,
              }
            : null;
    });

    constructor() {
        const host = injectHost();
        bindAttributes(host, () => ({
            ...this.attributes(),
            "data-flow-part": "nodes-selection",
        }));
        bindStructuralStyle(host, () => {
            const rect = this.rect();
            return {
                position: "absolute",
                top: 0,
                left: 0,
                transform: rect
                    ? `translate(${rect.x}px, ${rect.y}px)`
                    : undefined,
                width: px(rect?.width),
                height: px(rect?.height),
            };
        });
        bindPresence(host, () => (this.rect() ? "here" : null));
    }
}
