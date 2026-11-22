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
import type { BuiltInEdgeType, XY } from "../document/types";
import type { FlowHandle } from "../engine/adapter";
import type { ConnectionEnd, MoveSource } from "../engine/events";
import type { Connection } from "../engine/verbs";
import type { KeyboardConnection } from "../features/keyboard-links";
import type { FeatureEngineHost, FeatureGesture } from "../features/types";
import { oppositeSide } from "../geometry/path-format";
import type { HandleSide } from "../geometry/types";

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
    /** it starts only once the pointer moved past this many pixels (a tap's distance) */
    readonly tolerance?: number | undefined;
    /** without `tolerance`, it starts once the pointer moved this many pixels; default 1 */
    readonly threshold?: number | undefined;
}

/** A handle as a connection's events name it. */
function endOf(handle: FlowHandle): ConnectionEnd {
    return {
        nodeId: handle.nodeId,
        handleId: handle.handleId,
        type: handle.type,
    };
}

/** The shared connection state of one engine. */
export class ConnectSession {
    /** how near (in pixels) a handle snaps; set by `connection()` */
    radius = 20;
    mode: ConnectMode = "strict";
    /** the connection line's path (`connection({ lineType })`) */
    lineType: BuiltInEdgeType = "bezier";
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
        if (!handle.center || !handle.connectableEnd) return false;
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
        const path = this.linePath(from.center, from.side, toPoint, toSide);
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
                this.cancelled(
                    start,
                    to !== undefined,
                    "keyboard",
                    this.keyboardDrop(source, to),
                );
            },
            cancel: () => {
                if (!open) return;
                const to = targets[index];
                finish();
                this.cancelled(
                    start,
                    false,
                    "keyboard",
                    this.keyboardDrop(source, to),
                );
            },
            open: () => open,
        };
    }

    /** The connection line's path (`lineType`), from the engine's path helpers. */
    private linePath(
        source: XY,
        sourceSide: HandleSide,
        target: XY,
        targetSide: HandleSide,
    ): string {
        return this.host.path(this.lineType, {
            source,
            sourceSide,
            target,
            targetSide,
        }).path;
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
        const path = this.linePath(fromPoint, from.side, toPoint, toSide);
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
        { following = false, tolerance, threshold = 1 }: GestureOptions = {},
    ): FeatureGesture {
        let active = following;
        // where the pointer was last: a cancel without a release (Escape) ends there
        let last = client;
        const finish = () => {
            this.state = null;
            this.host.changed();
        };
        if (following) {
            this.started(start);
            this.update(start, client);
        }
        return {
            autoPan: "connect",
            kind: start.reconnecting ? "reconnect" : "connect",
            move: (event) => {
                const point = { x: event.clientX, y: event.clientY };
                last = point;
                if (!active) {
                    const travel = Math.hypot(
                        point.x - client.x,
                        point.y - client.y,
                    );
                    if (
                        tolerance === undefined
                            ? travel < threshold
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
                const drop = { x: event.clientX, y: event.clientY };
                this.update(start, drop);
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
                this.cancelled(start, to !== undefined, "pointer", {
                    to,
                    client: drop,
                    point: this.host.toFlow(drop),
                });
            },
            cancel: () => {
                if (!active) return;
                const to = this.state?.to;
                finish();
                this.cancelled(start, false, "pointer", {
                    to,
                    client: last,
                    point: this.host.toFlow(last),
                });
            },
            active: () => active,
        };
    }

    /**
     * Tells a connection ended without an edge, with where it ended: the handle it was over (if
     * any) and the drop point, as a client point and a flow point.
     */
    private cancelled(
        start: ConnectStart,
        refused: boolean,
        input: MoveSource,
        at: { to: FlowHandle | undefined; client: XY; point: XY },
    ): void {
        const drop = {
            from: endOf(start.from),
            to: at.to ? endOf(at.to) : undefined,
            client: at.client,
            point: at.point,
        };
        if (start.reconnecting) {
            this.host.emit({
                type: "reconnect-cancel",
                edgeId: start.reconnecting.edgeId,
                end: start.reconnecting.end,
                refused,
                ...drop,
            });
        } else {
            this.host.emit({ type: "connect-cancel", refused, input, ...drop });
        }
    }

    /** Where a keyboard connection pointing at `to` ends: its target's centre, or its start's. */
    private keyboardDrop(from: FlowHandle & { center: XY }, to?: FlowHandle) {
        const point = to?.center ?? from.center;
        return { to, point, client: this.host.toClient(point) };
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
