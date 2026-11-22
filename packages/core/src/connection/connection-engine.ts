// The connection feature's engine side (D7, D10): a press on a connectable handle that moves
// draws a connection line (`engine.get("connection")`); it snaps to the nearest eligible handle
// within `radius`, valid when `model.can("edge.add", …)`, and a drop there adds the edge. With
// `clickToConnect`, a tap on a connectable handle starts the same connection without a press: the
// engine moves it with the pointer, and the next press's release is its drop (a tap on another
// handle connects; elsewhere it is cancelled, as Escape does). With `keyboard()`, a focused handle
// starts a keyboard connection (its keys are the keyboard's; the session's `keyboard`).
import { connectSessionOf } from "../connect-session/connect-session";
import type { FlowHandle, PressTarget } from "../engine/adapter";
import { keyboardLinks } from "../features/keyboard-links";
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
    session.lineType = options.lineType;

    /** The handle a press or a tap on `target` starts a connection from, if it may. */
    const startable = (target: PressTarget): FlowHandle | undefined => {
        const handle = target.handle;
        return target.kind === "handle" &&
            handle?.connectableStart === true &&
            host.allows("connect") &&
            session.current() === null &&
            host.model.is("node-connectable", { nodeId: handle.nodeId })
            ? handle
            : undefined;
    };

    // with keyboard(): Enter on a focused handle draws a connection from it
    keyboardLinks(host).connect = {
        start: (from) =>
            startable({ kind: "handle", element: undefined, handle: from })
                ? session.keyboard(from)
                : undefined,
    };

    return {
        get: { connection: () => session.current() },
        is: { connecting: () => session.current() !== null },
        pointerdown: (event, target) => {
            const handle = startable(target);
            // with click-to-connect, a press that barely moves stays a tap (it starts one)
            return handle
                ? session.gesture(
                      { from: handle },
                      { x: event.clientX, y: event.clientY },
                      options.clickToConnect
                          ? {
                                tolerance: Math.max(
                                    host.tapDistance("node"),
                                    options.threshold,
                                ),
                            }
                          : { threshold: options.threshold },
                  )
                : undefined;
        },
        tap: (event, target) => {
            if (!options.clickToConnect) return undefined;
            const handle = startable(target);
            return handle
                ? session.gesture(
                      { from: handle },
                      { x: event.clientX, y: event.clientY },
                      { following: true },
                  )
                : undefined;
        },
        attributes: (part, payload, into) =>
            session.attributes(part, payload, into),
        detached: () => session.reset(),
    };
}
