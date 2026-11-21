// The resize feature (D2, `@fragiola/flow/resize`): the NodeResizer's gestures, with a minimum and
// a maximum size and a kept aspect ratio. Its model side is the core's `node.resize` (with a
// position, for a resize from a top or left edge), run as `transient` steps; its engine side
// (`resize-engine.ts`: the eight handles, the constraints, resizing a parent with children) reads
// `options`, over which a resizer's own win.
import type { FlowFeature } from "../features/types";
import { resizeEngine } from "./resize-engine";

/** Options of {@link resize}: the defaults of every resizer, read by its engine side. */
export interface ResizeOptions {
    /** the smallest width; default 10 */
    readonly minWidth: number;
    /** the smallest height; default 10 */
    readonly minHeight: number;
    /** the largest width; default none */
    readonly maxWidth: number;
    /** the largest height; default none */
    readonly maxHeight: number;
    /** whether a resize keeps the node's width-to-height ratio; default false */
    readonly keepAspectRatio: boolean;
}

/** The resize feature, as `resize()` makes it. */
export type ResizeFeature = FlowFeature<"resize", ResizeOptions>;

/** Resizing nodes: `features: [resize()]` (`@fragiola/flow/resize`). */
export function resize(options: Partial<ResizeOptions> = {}): ResizeFeature {
    const resolved: ResizeOptions = Object.freeze({
        minWidth: options.minWidth ?? 10,
        minHeight: options.minHeight ?? 10,
        maxWidth: options.maxWidth ?? Number.POSITIVE_INFINITY,
        maxHeight: options.maxHeight ?? Number.POSITIVE_INFINITY,
        keepAspectRatio: options.keepAspectRatio ?? false,
    });
    return Object.freeze({
        name: "resize",
        options: resolved,
        engine: (host) => resizeEngine(host, resolved),
    } satisfies ResizeFeature);
}
