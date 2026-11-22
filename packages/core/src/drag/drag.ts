// The drag feature (D2, `@fragiola/flow/drag`): node dragging, snap to a grid, multi-node drag,
// extent. Its model side is the core's `node.move` (refused for a node that is not draggable),
// which a drag runs as `transient` steps, then once more for the drop (D9); its engine side
// (`drag-engine.ts`: Pointer Events, the threshold, the snap, moving every selected node) reads
// `options`.
import type { FlowFeature } from "../features/types";
import { dragEngine } from "./drag-engine";

/** Options of {@link drag}: read by its engine side. */
export interface DragOptions {
    /** the grid a dragged node's position snaps to, `[x, y]` in flow units; none: no snap */
    readonly snapGrid: readonly [number, number] | undefined;
    /** how far (in pixels) a press moves before it is a drag; default 1 */
    readonly threshold: number;
    /**
     * a drag of a node that is not selected selects it first (it is then dragged alone); false
     * drags it unselected, the selection kept; default true
     */
    readonly selectOnDrag: boolean;
}

/** The drag feature, as `drag()` makes it. */
export type DragFeature = FlowFeature<"drag", DragOptions>;

/** Dragging nodes: `features: [drag()]` (`@fragiola/flow/drag`). */
export function drag(options: Partial<DragOptions> = {}): DragFeature {
    const resolved: DragOptions = Object.freeze({
        snapGrid: options.snapGrid
            ? (Object.freeze([...options.snapGrid]) as readonly [
                  number,
                  number,
              ])
            : undefined,
        threshold: options.threshold ?? 1,
        selectOnDrag: options.selectOnDrag ?? true,
    });
    return Object.freeze({
        name: "drag",
        options: resolved,
        engine: (host) => dragEngine(host, resolved),
    } satisfies DragFeature);
}
