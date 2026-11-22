// The part attributes (D11): every element of every primitive carries `data-flow-part` (its part
// name) and, when it stands for an entity, `data-flow-id` (the node's, edge's or handle's id). The
// state attributes are booleans (present as `""`, absent otherwise: `data-selected`,
// `data-dragging`, `data-connecting`, `data-valid` / `data-invalid`, …) or values (`data-handle-type`,
// `data-side`, `data-position`). The engine computes them (`engine.adapter.attributes(part, …)`),
// so every adapter spreads the same record; `partAttributes` gives the static ones without an
// engine (a server render, a part with no state).

/** The attribute naming an element's part. */
export const PART_ATTRIBUTE = "data-flow-part";

/** The attribute holding the id of the entity a part stands for. */
export const ID_ATTRIBUTE = "data-flow-id";

/** The attribute a resize handle carries: which corner or side of its node it moves. */
export const POSITION_ATTRIBUTE = "data-position";

/** The attribute a reconnect anchor carries: which end of its edge it moves (`source`, `target`). */
export const END_ATTRIBUTE = "data-end";

/** The attribute an edges layer carries: its render level (`render-layers`), 0 the lowest. */
export const LEVEL_ATTRIBUTE = "data-level";

/** A subtree inside a node that starts no gesture when pressed (a slider, a text field). */
export const NO_GESTURE_ATTRIBUTE = "data-flow-no-gesture";

/**
 * An element inside a node that is its drag handle: a node holding one is dragged only from it (a
 * press elsewhere on it still selects it).
 */
export const DRAG_HANDLE_ATTRIBUTE = "data-flow-drag-handle";

/** A subtree inside the flow where the wheel scrolls its content instead of zooming the flow. */
export const NO_WHEEL_ATTRIBUTE = "data-flow-no-wheel";

/** The parts of the flow's primitives (an adapter may use others: `toolbar`, `panel`, …). */
export type FlowPart =
    | "root"
    | "viewport"
    | "nodes"
    | "node"
    | "edges"
    | "edges-layer"
    | "edge"
    | "edge-path"
    | "edge-label"
    | "reconnect-anchor"
    | "handle"
    | "connection-line"
    | "selection-box"
    | "nodes-selection"
    | "background"
    | "controls"
    | "minimap"
    | "minimap-node"
    | "minimap-mask"
    | "resizer"
    | "resize-handle"
    | "toolbar"
    | "panel";

/** A part's attributes: names to values, `undefined` for an attribute the element does not have. */
export type PartAttributes = Readonly<Record<string, string | undefined>>;

/** A writable attribute record, as the engine and its features fill it. */
export type MutablePartAttributes = Record<string, string | undefined>;

/** A boolean state attribute's value: present (`""`) or absent. */
export function flag(on: boolean): string | undefined {
    return on ? "" : undefined;
}

/** The static attributes of a part: its name and, for an entity, its id. */
export function partAttributes(part: string, id?: string): PartAttributes {
    return id === undefined
        ? { [PART_ATTRIBUTE]: part }
        : { [PART_ATTRIBUTE]: part, [ID_ATTRIBUTE]: id };
}

/**
 * The attributes of one render level's edges layer (`edges-layer`, with several levels): its part
 * and its `data-level`. Static: the same with or without an engine.
 */
export function edgesLayerAttributes(level: number): PartAttributes {
    return {
        [PART_ATTRIBUTE]: "edges-layer",
        [LEVEL_ATTRIBUTE]: String(level),
    };
}
