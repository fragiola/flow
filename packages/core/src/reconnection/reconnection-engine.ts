// The reconnection feature's engine side: a press on an edge within `radius` pixels of one of its
// ends drags that end; the connection line runs from the edge's other end (the session of
// `connection()`, shared through the host), valid when `model.can("edge.reconnect", …)`, and a
// drop there reconnects the edge.
import { connectSessionOf } from "../connect-session/connect-session";
import type { FlowEdge } from "../document/types";
import type { FlowHandle } from "../engine/adapter";
import type { FeatureEngine, FeatureEngineHost } from "../features/types";
import { toScreen } from "../geometry/viewport-math";
import type { ReconnectionOptions } from "./reconnection";

/** The engine side of `reconnection()`. */
export function reconnectionEngine(
    host: FeatureEngineHost,
    options: ReconnectionOptions,
): FeatureEngine {
    const session = connectSessionOf(host);
    /** The handle the fixed end of an edge is at (registered, or as its path draws it). */
    const fixedEnd = (
        edge: FlowEdge,
        end: "source" | "target",
    ): FlowHandle | undefined => {
        const path = host.edgePath(edge.id);
        if (!path) return undefined;
        const fixed = end === "source" ? "target" : "source";
        const nodeId = fixed === "source" ? edge.source : edge.target;
        const handleId =
            fixed === "source" ? edge.sourceHandle : edge.targetHandle;
        const candidates = host
            .handles()
            .filter(
                (handle) =>
                    handle.nodeId === nodeId &&
                    handle.handleId === handleId &&
                    handle.center !== undefined,
            );
        const registered =
            candidates.find((handle) => handle.type === fixed) ?? candidates[0];
        return (
            registered ?? {
                nodeId,
                handleId,
                type: fixed,
                side: fixed === "source" ? path.sourceSide : path.targetSide,
                connectable: true,
                center: fixed === "source" ? path.source : path.target,
                bounds: undefined,
            }
        );
    };
    return {
        is: {
            "edge-reconnecting": (payload) =>
                session.current()?.reconnecting?.edgeId ===
                (payload as { edgeId?: unknown }).edgeId,
        },
        pointerdown: (event, target) => {
            if (
                target.kind !== "edge" ||
                target.edgeId === undefined ||
                !host.interactive() ||
                session.current() !== null ||
                !host.model.is("edge-reconnectable", { edgeId: target.edgeId })
            ) {
                return undefined;
            }
            const edge = host.model.get("edge-by", { id: target.edgeId }) as
                | FlowEdge
                | undefined;
            const path = edge && host.edgePath(edge.id);
            if (!edge || !path) return undefined;
            const pointer = host.toRoot({ x: event.clientX, y: event.clientY });
            const near = (point: { x: number; y: number }) => {
                const screen = toScreen(host.viewport(), point);
                return Math.hypot(screen.x - pointer.x, screen.y - pointer.y);
            };
            const toTarget = near(path.target);
            const toSource = near(path.source);
            if (Math.min(toTarget, toSource) > options.radius) return undefined;
            const end = toTarget <= toSource ? "target" : "source";
            const from = fixedEnd(edge, end);
            if (!from) return undefined;
            return session.gesture(
                { from, reconnecting: { edgeId: edge.id, end } },
                { x: event.clientX, y: event.clientY },
            );
        },
    };
}
