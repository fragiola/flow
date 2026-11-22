// The minimap feature (D2, `@fragiola/flow/minimap`): a small view of the whole flow and of what
// the viewport shows, which pans and zooms the viewport. It has no model side: its geometry (the
// `minimap-view` engine key) and its gestures are its engine side (`minimap-engine.ts`), reading
// `options`.
import type { FlowFeature } from "../features/types";
import { minimapEngine, zoomStepOf } from "./minimap-engine";

/** Options of {@link minimap}: read by its engine side. */
export interface MinimapOptions {
    /** whether a press or a drag on the minimap pans the viewport; default true */
    readonly pannable: boolean;
    /** whether the wheel over the minimap zooms the viewport; default true */
    readonly zoomable: boolean;
    /** the share of the minimap's size kept free around the nodes and the view, on every side; default 0.1 */
    readonly padding: number;
    /**
     * whether a drag on the minimap moves the view the other way from the pointer (as grabbing
     * the flow): a press does not centre the view then; default false
     */
    readonly inversePan: boolean;
    /**
     * how fast the wheel over the minimap zooms: 10 is the flow's own wheel, 20 twice as fast;
     * default 10 (also for a value that is not a finite number above 0)
     */
    readonly zoomStep: number;
}

/** The minimap feature, as `minimap()` makes it. */
export type MinimapFeature = FlowFeature<"minimap", MinimapOptions>;

/** A minimap of the flow: `features: [minimap()]` (`@fragiola/flow/minimap`). */
export function minimap(options: Partial<MinimapOptions> = {}): MinimapFeature {
    const resolved: MinimapOptions = Object.freeze({
        pannable: options.pannable ?? true,
        zoomable: options.zoomable ?? true,
        padding: options.padding ?? 0.1,
        inversePan: options.inversePan ?? false,
        zoomStep: zoomStepOf(options.zoomStep) ?? 10,
    });
    return Object.freeze({
        name: "minimap",
        options: resolved,
        engine: (host) => minimapEngine(host, resolved),
    } satisfies MinimapFeature);
}
