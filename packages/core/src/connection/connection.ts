// The connection feature (D2, `@fragiola/flow/connection`): dragging from a handle draws a
// connection line, and dropping it on another handle adds an edge (with `clickToConnect`, a tap on
// a handle and a tap on another do too). Its validity is the core's
// `model.can("edge.add", …)` (D7: a middleware's veto marks the target invalid and refuses the
// drop). Its engine side (`connection-engine.ts`: the gesture, the line's points, the nearest
// handle within `radius`, the `connection` engine key) reads `options`.
import type { BuiltInEdgeType } from "../document/types";
import type { FlowFeature } from "../features/types";
import { connectionEngine } from "./connection-engine";

/**
 * Which handles a connection may end at: only a target handle when it started at a source one
 * (`"strict"`), or any handle of another node (`"loose"`).
 */
export type ConnectionMode = "strict" | "loose";

/** Options of {@link connection}: read by its engine side. */
export interface ConnectionOptions {
    /** how near (in pixels) a handle must be for a drop to snap to it; default 20 */
    readonly radius: number;
    /** which handles a connection may end at; default `"strict"` */
    readonly mode: ConnectionMode;
    /**
     * a tap on a handle starts a connection that follows the pointer, and a tap on another handle
     * ends it (elsewhere, or Escape, cancels it); default false
     */
    readonly clickToConnect: boolean;
    /**
     * how far (in pixels) a press on a handle moves before it draws a connection; default 1
     * (with `clickToConnect`, a press within the tap distance stays a tap whatever it is)
     */
    readonly threshold: number;
    /** the connection line's path, one of the built-in edge types; default `"bezier"` */
    readonly lineType: BuiltInEdgeType;
}

/** The connection feature, as `connection()` makes it. */
export type ConnectionFeature = FlowFeature<"connection", ConnectionOptions>;

/** Drawing new edges from handles: `features: [connection()]` (`@fragiola/flow/connection`). */
export function connection(
    options: Partial<ConnectionOptions> = {},
): ConnectionFeature {
    const resolved: ConnectionOptions = Object.freeze({
        radius: options.radius ?? 20,
        mode: options.mode ?? "strict",
        clickToConnect: options.clickToConnect ?? false,
        threshold: options.threshold ?? 1,
        lineType: options.lineType ?? "bezier",
    });
    return Object.freeze({
        name: "connection",
        options: resolved,
        engine: (host) => connectionEngine(host, resolved),
    } satisfies ConnectionFeature);
}
