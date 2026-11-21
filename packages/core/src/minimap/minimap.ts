// The minimap feature (D2, `@fragiola/flow/minimap`): a small view of the whole flow and of what
// the viewport shows, which pans and zooms the viewport. It has no model side: its geometry (the
// `minimap-view` engine key) and its gestures are its engine side (`minimap-engine.ts`), reading
// `options`.
import type { FlowFeature } from "../features/types";
import { minimapEngine } from "./minimap-engine";

/** Options of {@link minimap}: read by its engine side. */
export interface MinimapOptions {
    /** whether a press or a drag on the minimap pans the viewport; default true */
    readonly pannable: boolean;
    /** whether the wheel over the minimap zooms the viewport; default true */
    readonly zoomable: boolean;
    /** the room (in minimap pixels) around the nodes and the view; default 5 */
    readonly padding: number;
}

/** The minimap feature, as `minimap()` makes it. */
export type MinimapFeature = FlowFeature<"minimap", MinimapOptions>;

/** A minimap of the flow: `features: [minimap()]` (`@fragiola/flow/minimap`). */
export function minimap(options: Partial<MinimapOptions> = {}): MinimapFeature {
    const resolved: MinimapOptions = Object.freeze({
        pannable: options.pannable ?? true,
        zoomable: options.zoomable ?? true,
        padding: options.padding ?? 5,
    });
    return Object.freeze({
        name: "minimap",
        options: resolved,
        engine: (host) => minimapEngine(host, resolved),
    } satisfies MinimapFeature);
}
