// The reconnection feature (D2, `@fragiola/flow/reconnection`, requires `connection()`): dragging
// an edge's end to another handle moves it. Its model side is `edge.reconnect`; its engine side
// (`reconnection-engine.ts`: the gesture from an edge's end, validity through
// `model.can("edge.reconnect", …)`) reads `options`.
import type { FlowFeature } from "../features/types";
import { edgeReconnect } from "./commands";
import { reconnectionEngine } from "./reconnection-engine";

/** Options of {@link reconnection}: read by its engine side. */
export interface ReconnectionOptions {
    /** how near (in pixels) to an edge's end a press must be to grab it; default 10 */
    readonly radius: number;
}

/** The reconnection feature, as `reconnection()` makes it. */
export type ReconnectionFeature = FlowFeature<
    "reconnection",
    ReconnectionOptions
>;

/**
 * Moving an edge's ends: `features: [connection(), reconnection()]`
 * (`@fragiola/flow/reconnection`; it requires `connection()`).
 */
export function reconnection(
    options: Partial<ReconnectionOptions> = {},
): ReconnectionFeature {
    const resolved: ReconnectionOptions = Object.freeze({
        radius: options.radius ?? 10,
    });
    return Object.freeze({
        name: "reconnection",
        requires: Object.freeze(["connection"] as const),
        options: resolved,
        commands: [edgeReconnect],
        engine: (host) => reconnectionEngine(host, resolved),
    } satisfies ReconnectionFeature);
}
