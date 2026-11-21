import { computed, Directive, effect, type Signal } from "@angular/core";
import { partAttributes, type Viewport } from "@fragiola/flow";
import { injectFlowContext } from "../context";
import { injectViewport } from "../inject/inject-viewport";
import {
    bindAttributes,
    bindStructuralStyle,
    injectHost,
} from "../utils/helpers";

export interface ViewportState {
    /** the viewport: the pan (`x`, `y`, pixels) and the zoom */
    viewport: Viewport;
}

const ATTRIBUTES = partAttributes("viewport");

/**
 * The pannable, zoomable layer (`data-flow-part="viewport"`), on the app's element inside
 * `[flowRoot]`: `<div flowViewport>`. What is inside is in flow coordinates (`[flowEdges]`,
 * `[flowNodes]`, `[flowConnectionLine]`). The engine writes its `transform` itself (D4), never
 * Angular: a pan or a zoom renders nothing inside it again.
 */
@Directive({ selector: "[flowViewport]", exportAs: "flowViewport" })
export class FlowViewportDirective {
    private readonly context = injectFlowContext("[flowViewport]");
    private readonly viewport = injectViewport();

    /** what it shows (`#v="flowViewport"`, then `v.state().viewport.zoom`) */
    readonly state: Signal<ViewportState> = computed(() => ({
        viewport: this.viewport(),
    }));

    constructor() {
        const host = injectHost();
        bindAttributes(host, () => ATTRIBUTES);
        bindStructuralStyle(host, () => ({
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
        }));
        // the engine writes its transform on it
        effect((onCleanup) => {
            const engine = this.context.engine();
            if (!engine) return;
            engine.adapter.attachViewport(host);
            onCleanup(() => engine.adapter.attachViewport(null));
        });
    }
}
