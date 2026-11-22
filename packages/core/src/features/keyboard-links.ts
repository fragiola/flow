// What `keyboard()` reaches of the other features of one engine, through the host's shared slot
// (features talk only through keys and the host, never by importing each other): `connection()`
// offers keyboard connections, `resize()` keyboard resize steps. Each fills its link when its
// engine side is made; `keyboard()` reads them when a key or a part's attributes ask, so the order
// of `features` does not matter, and a link left empty means its feature is not installed.
import type { XY } from "../document/types";
import type { FlowHandle } from "../engine/adapter";
import type { FeatureEngineHost } from "./types";

/** A connection drawn with the keyboard, from a handle to the targets the model accepts. */
export interface KeyboardConnection {
    /** points at the next (`1`) or the previous (`-1`) target, round the list */
    next(by: 1 | -1): void;
    /** adds the edge to the target pointed at (`edge.add`) and ends; without one it cancels */
    connect(): void;
    /** ends with no edge */
    cancel(): void;
    /** whether it has not ended yet */
    open(): boolean;
}

/** What `connection()` offers the keyboard. */
export interface KeyboardConnector {
    /** starts a connection from a focused handle, or nothing when it may not start one */
    start(from: FlowHandle): KeyboardConnection | undefined;
}

/** What `resize()` offers the keyboard. */
export interface KeyboardResizer {
    /**
     * moves the sides a resize handle at `position` moves by `delta` flow units, within the
     * resizer's limits, in one step (`node.resize`); whether the node changed
     */
    step(nodeId: string, position: string, delta: XY): boolean;
}

/** The links of one engine. */
export interface KeyboardLinks {
    connect?: KeyboardConnector | undefined;
    resize?: KeyboardResizer | undefined;
}

/** The keyboard links of an engine (one object per engine, made by the first feature that asks). */
export function keyboardLinks(host: FeatureEngineHost): KeyboardLinks {
    return host.shared<KeyboardLinks>("keyboard-links", () => ({}));
}
