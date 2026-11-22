// The connection under way, shared by `connection()` and `reconnection()` of one engine (through
// `host.shared`, so neither imports the other): it starts at a handle (a new edge) or at an edge's
// fixed end (a reconnection), follows the pointer, snaps to the nearest eligible handle within the
// radius, and asks the model whether the drop would be taken (D7: `model.can("edge.add", …)` or
// `model.can("edge.reconnect", …)`, so a middleware's veto marks the handle invalid). Its drop runs
// the command; nothing is committed before it. An internal folder with no entry: only the two
// features' entries import it.
import {
    flag,
    type MutablePartAttributes,
} from "../attributes/part-attributes";
import type { ConnectionPayload } from "../commands/types";
import type { XY } from "../document/types";
import type { FlowHandle } from "../engine/adapter";
import type { MoveSource } from "../engine/events";
import type { Connection } from "../engine/verbs";
import type { KeyboardConnection } from "../features/keyboard-links";
import type { FeatureEngineHost, FeatureGesture } from "../features/types";
import { bezierPath } from "../geometry/bezier-path";
import { oppositeSide } from "../geometry/path-format";

/** Which handles a connection may end at (`connection({ mode })`). */
export type ConnectMode = "strict" | "loose";

/** What a connection starts from: a handle, or (a reconnection) an edge's fixed end. */
export interface ConnectStart {
    readonly from: FlowHandle;
    readonly reconnecting?:
        | { readonly edgeId: string; readonly end: "source" | "target" }
        | undefined;
}

/** How a connection gesture starts (`ConnectSession.gesture`). */
export interface GestureOptions {
    /** it has started already: a tap began it */
    readonly following?: boolean | undefined;
    /** it starts only once the pointer moved past this many pixels; default: 1 pixel */
    readonly tolerance?: number | undefined;
}

/** The shared connection state of one engine. */
export class ConnectSession {
    /** how near (in pixels) a handle snaps; set by `connection()` */
    radius = 20;
    mode: ConnectMode = "strict";
    private state: Connection | null = null;

    constructor(private readonly host: FeatureEngineHost) {}

    /** The connection being drawn, or null. */
    current(): Connection | null {
        return this.state;
    }

    /** The edge new ends would make. */
    private ends(from: FlowHandle, to: FlowHandle): ConnectionPayload {
        const [source, target] =
            from.type === "source" ? [from, to] : [to, from];
        return {
            source: source.nodeId,
            target: target.nodeId,
            ...(source.handleId === undefined
                ? {}
                : { sourceHandle: source.handleId }),
            ...(target.handleId === undefined
                ? {}
                : { targetHandle: target.handleId }),
        };
    }

    private valid(start: ConnectStart, to: FlowHandle): boolean {
        const ends = this.ends(start.from, to);
        return start.reconnecting
            ? this.host.model.can("edge.reconnect", {
                  edgeId: start.reconnecting.edgeId,
                  ...ends,
              })
            : this.host.model.can("edge.add", ends);
    }

    /** Whether a connection from `from` may end at `handle` (the model not asked yet). */
    private eligible(from: FlowHandle, handle: FlowHandle): boolean {
        if (!handle.center || !handle.connectable) return false;
        const same =
            handle.nodeId === from.nodeId &&
            handle.type === from.type &&
            handle.handleId === from.handleId;
        if (same) return false;
        if (this.mode === "strict" && handle.type === from.type) return false;
        return this.host.model.is("node-connectable", {
            nodeId: handle.nodeId,
        });
    }

    /** The eligible handle nearest to a flow point, within the radius. */
    private nearest(start: ConnectStart, point: XY): FlowHandle | undefined {
        const { from } = start;
        const reach = this.radius / this.host.viewport().zoom;
        let best: FlowHandle | undefined;
        let bestDistance = Number.POSITIVE_INFINITY;
        for (const handle of this.host.handles()) {
            if (!handle.center || !this.eligible(from, handle)) continue;
            const d = Math.hypot(
                handle.center.x - point.x,
                handle.center.y - point.y,
            );
            if (d <= reach && d < bestDistance) {
                best = handle;
                bestDistance = d;
            }
        }
        return best;
    }

    /** The connection state of a keyboard connection from `from` pointing at `to` (or nowhere). */
    private aimAt(
        from: FlowHandle & { center: XY },
        to: FlowHandle | undefined,
    ): void {
        const toPoint = to?.center ?? from.center;
        const toSide = to?.side ?? oppositeSide(from.side);
        const { path } = bezierPath({
            source: from.center,
            sourceSide: from.side,
            target: toPoint,
            targetSide: toSide,
        });
        this.state = Object.freeze({
            from,
            fromPoint: from.center,
            toPoint,
            toSide,
            to,
            status: to ? "valid" : null,
            path,
            reconnecting: undefined,
        });
        this.host.changed();
    }

    /**
     * A connection drawn with the keyboard from a measured handle (`keyboard()` with
     * `connection()`): its targets are the eligible handles `model.can("edge.add", …)` accepts
     * (a vetoed one is skipped), nearest to it first; it points at the first, `next` walks them
     * round, `connect` adds the edge to the one pointed at. Nothing when a connection is under way.
     */
    keyboard(from: FlowHandle): KeyboardConnection | undefined {
        const center = from.center;
        if (this.state !== null || !center) return undefined;
        const start: ConnectStart = { from };
        const targets = this.host
            .handles()
            .filter(
                (handle) =>
                    this.eligible(from, handle) && this.valid(start, handle),
            )
            .map((handle) => ({
                handle,
                distance: Math.hypot(
                    (handle.center?.x ?? 0) - center.x,
                    (handle.center?.y ?? 0) - center.y,
                ),
            }))
            .sort((a, b) => a.distance - b.distance)
            .map(({ handle }) => handle);
        const source = { ...from, center };
        let index = targets.length > 0 ? 0 : -1;
        let open = true;
        const aim = () => {
            const to = targets[index];
            this.aimAt(source, to);
            this.host.emit({
                type: "connect-target",
                nodeId: to?.nodeId,
                handleId: to?.handleId,
                handleType: to?.type,
                index,
                count: targets.length,
            });
        };
        this.started(start, "keyboard");
        aim();
        const finish = () => {
            open = false;
            this.state = null;
            this.host.changed();
        };
        return {
            next: (by) => {
                if (!open || targets.length < 2) return;
                index = (index + by + targets.length) % targets.length;
                aim();
            },
            connect: () => {
                if (!open) return;
                const to = targets[index];
                finish();
                if (to) {
                    const ends = this.ends(from, to);
                    const result = this.host.model.run("edge.add", ends);
                    if (result.ok) {
                        const { edgeId } = result.value as { edgeId: string };
                        this.host.emit({
                            type: "connect",
                            edgeId,
                            source: ends.source,
                            target: ends.target,
                            input: "keyboard",
                        });
                        return;
                    }
                }
                this.cancelled(start, to !== undefined, "keyboard");
            },
            cancel: () => {
                if (!open) return;
                finish();
                this.cancelled(start, false, "keyboard");
            },
            open: () => open,
        };
    }

    private update(start: ConnectStart, client: XY): void {
        const { from } = start;
        const fromPoint = from.center ?? this.host.toFlow(client);
        const pointer = this.host.toFlow(client);
        const to = this.nearest(start, pointer);
        const toPoint = to?.center ?? pointer;
        const toSide = to?.side ?? oppositeSide(from.side);
        const status = to
            ? this.valid(start, to)
                ? "valid"
                : "invalid"
            : null;
        const { path } = bezierPath({
            source: fromPoint,
            sourceSide: from.side,
            target: toPoint,
            targetSide: toSide,
        });
        this.state = Object.freeze({
            from,
            fromPoint,
            toPoint,
            toSide,
            to,
            status,
            path,
            reconnecting: start.reconnecting,
        });
        this.host.changed();
    }

    private started(start: ConnectStart, input: MoveSource = "pointer"): void {
        if (start.reconnecting) {
            this.host.emit({
                type: "reconnect-start",
                edgeId: start.reconnecting.edgeId,
                end: start.reconnecting.end,
            });
        } else {
            this.host.emit({
                type: "connect-start",
                nodeId: start.from.nodeId,
                handleId: start.from.handleId,
                handleType: start.from.type,
                input,
            });
        }
    }

    /**
     * A gesture drawing a connection from `start`, pressed at `client`: it starts once the pointer
     * moves (1 pixel, or past `tolerance` pixels: a press that moves less stays a tap); `following`,
     * it has started (a tap began it: it follows the pointer until the next press's release, its
     * drop).
     */
    gesture(
        start: ConnectStart,
        client: XY,
        { following = false, tolerance }: GestureOptions = {},
    ): FeatureGesture {
        let active = following;
        const finish = () => {
            this.state = null;
            this.host.changed();
        };
        if (following) {
            this.started(start);
            this.update(start, client);
        }
        return {
            autoPan: true,
            move: (event) => {
                const point = { x: event.clientX, y: event.clientY };
                if (!active) {
                    const travel = Math.hypot(
                        point.x - client.x,
                        point.y - client.y,
                    );
                    if (
                        tolerance === undefined
                            ? travel < 1
                            : travel <= tolerance
                    )
                        return;
                    active = true;
                    this.started(start);
                }
                this.update(start, point);
            },
            end: (event) => {
                if (!active) return;
                this.update(start, { x: event.clientX, y: event.clientY });
                const state = this.state;
                finish();
                const to = state?.to;
                if (to && state?.status === "valid") {
                    const ends = this.ends(start.from, to);
                    if (start.reconnecting) {
                        const { edgeId } = start.reconnecting;
                        const result = this.host.model.run("edge.reconnect", {
                            edgeId,
                            ...ends,
                        });
                        if (result.ok) {
                            this.host.emit({
                                type: "reconnect",
                                edgeId,
                                source: ends.source,
                                target: ends.target,
                            });
                            return;
                        }
                    } else {
                        const result = this.host.model.run("edge.add", ends);
                        if (result.ok) {
                            const { edgeId } = result.value as {
                                edgeId: string;
                            };
                            this.host.emit({
                                type: "connect",
                                edgeId,
                                source: ends.source,
                                target: ends.target,
                                input: "pointer",
                            });
                            return;
                        }
                    }
                }
                this.cancelled(start, to !== undefined);
            },
            cancel: () => {
                if (!active) return;
                finish();
                this.cancelled(start, false);
            },
            active: () => active,
        };
    }

    private cancelled(
        start: ConnectStart,
        refused: boolean,
        input: MoveSource = "pointer",
    ): void {
        if (start.reconnecting) {
            this.host.emit({
                type: "reconnect-cancel",
                edgeId: start.reconnecting.edgeId,
                refused,
            });
        } else {
            this.host.emit({ type: "connect-cancel", refused, input });
        }
    }

    /** The state attributes of the connection's parts. */
    attributes(
        part: string,
        payload: Readonly<Record<string, unknown>>,
        into: MutablePartAttributes,
    ): void {
        const state = this.state;
        if (part === "root") {
            into["data-connecting"] = flag(state !== null);
            return;
        }
        if (part === "connection-line") {
            into["data-valid"] = flag(state?.status === "valid");
            into["data-invalid"] = flag(state?.status === "invalid");
            return;
        }
        if (part === "handle") {
            const is = (handle: FlowHandle | undefined) =>
                handle !== undefined &&
                handle.nodeId === payload.nodeId &&
                handle.type === payload.type &&
                handle.handleId === payload.handleId;
            into["data-connecting"] = flag(state !== null && is(state.from));
            const target = state !== null && is(state.to);
            into["data-valid"] = flag(target && state?.status === "valid");
            into["data-invalid"] = flag(target && state?.status === "invalid");
            return;
        }
        if (
            part === "edge" ||
            part === "edge-path" ||
            part === "reconnect-anchor"
        ) {
            into["data-reconnecting"] = flag(
                state?.reconnecting !== undefined &&
                    state.reconnecting.edgeId === payload.edgeId,
            );
        }
    }

    /** Ends the connection with nothing committed (the root went away). */
    reset(): void {
        this.state = null;
    }
}

/** The session of an engine, made by the first feature that asks. */
export function connectSessionOf(host: FeatureEngineHost): ConnectSession {
    return host.shared("connect-session", () => new ConnectSession(host));
}
