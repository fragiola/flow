// The connection feature's engine side (D7, D10): a press on a connectable handle that moves
// draws a connection line (`engine.get("connection")`); it snaps to the nearest eligible handle
// within `radius`, valid when `model.can("edge.add", …)`, and a drop there adds the edge.
import { connectSessionOf } from "../connect-session/connect-session";
import type { FeatureEngine, FeatureEngineHost } from "../features/types";
import type { ConnectionOptions } from "./connection";

/** The engine side of `connection()`. */
export function connectionEngine(
    host: FeatureEngineHost,
    options: ConnectionOptions,
): FeatureEngine {
    const session = connectSessionOf(host);
    session.radius = options.radius;
    session.mode = options.mode;
    return {
        get: { connection: () => session.current() },
        is: { connecting: () => session.current() !== null },
        pointerdown: (event, target) => {
            const handle = target.handle;
            if (
                target.kind !== "handle" ||
                !handle ||
                !handle.connectable ||
                !host.interactive() ||
                session.current() !== null ||
                !host.model.is("node-connectable", { nodeId: handle.nodeId })
            ) {
                return undefined;
            }
            return session.gesture(
                { from: handle },
                { x: event.clientX, y: event.clientY },
            );
        },
        attributes: (part, payload, into) =>
            session.attributes(part, payload, into),
        detached: () => session.reset(),
    };
}
