import type {
    AnyTypes,
    FlowEdge,
    FlowNode,
    FlowTypes,
    XY,
} from "@fragiola/flow-svelte";

// What the clipboard holds, without a framework or a browser: the selected nodes and the edges
// between them (`copyOf`), as JSON marked as this app's (`serialize`, `parse`: any other text on
// the system clipboard is ignored), and how a paste places them (`cascade`, `shiftFor`) and gives
// them ids the flow does not hold yet (`pasted`).

/** The marker a payload carries: text without it, or of another version, is someone else's. */
export const KIND = "fragiola-flow/clipboard";

/** How far (flow units) each paste moves from the last one, on both axes. */
export const OFFSET = 24;

/** What a copy puts on the clipboard: nodes, and the edges whose two ends are among them. */
export interface Payload<T extends FlowTypes = AnyTypes> {
    readonly kind: typeof KIND;
    readonly version: 1;
    readonly nodes: readonly FlowNode<T>[];
    readonly edges: readonly FlowEdge<T>[];
}

/** A copy of a node or an edge as the clipboard keeps it: not selected. */
function unselected<E extends { readonly selected?: boolean }>(entity: E): E {
    const { selected: _, ...rest } = entity;
    return rest as E;
}

/**
 * The payload of the nodes `nodeIds` names, and of the edges between two of them: an edge to a
 * node left out stays behind.
 */
export function copyOf<T extends FlowTypes>(
    nodes: readonly FlowNode<T>[],
    edges: readonly FlowEdge<T>[],
    nodeIds: Iterable<string>,
): Payload<T> {
    const ids = new Set(nodeIds);
    return {
        kind: KIND,
        version: 1,
        nodes: nodes.filter((node) => ids.has(node.id)).map(unselected),
        edges: edges
            .filter((edge) => ids.has(edge.source) && ids.has(edge.target))
            .map(unselected),
    };
}

/** The payload as the system clipboard's text. */
export function serialize<T extends FlowTypes>(payload: Payload<T>): string {
    return JSON.stringify(payload);
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value);

const isNodeLike = (value: unknown) =>
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.type === "string" &&
    isRecord(value.position) &&
    isFiniteNumber(value.position.x) &&
    isFiniteNumber(value.position.y);

const isEdgeLike = (value: unknown) =>
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.source === "string" &&
    typeof value.target === "string";

/**
 * The payload a text holds, or `undefined`: text that is no JSON, has no marker, another version,
 * no node, or an edge to a node it does not hold. The nodes' data is the app's to check (the
 * example checks the whole document with `validateFlow` before pasting it).
 */
export function parse<T extends FlowTypes = AnyTypes>(
    text: string | null | undefined,
): Payload<T> | undefined {
    if (!text) return undefined;
    let value: unknown;
    try {
        value = JSON.parse(text);
    } catch {
        return undefined;
    }
    if (
        !isRecord(value) ||
        value.kind !== KIND ||
        value.version !== 1 ||
        !Array.isArray(value.nodes) ||
        !Array.isArray(value.edges) ||
        value.nodes.length === 0 ||
        !value.nodes.every(isNodeLike) ||
        !value.edges.every(isEdgeLike)
    )
        return undefined;
    const ids = new Set(
        (value.nodes as { id: string }[]).map((node) => node.id),
    );
    const inner = (value.edges as { source: string; target: string }[]).every(
        (edge) => ids.has(edge.source) && ids.has(edge.target),
    );
    return inner ? (value as unknown as Payload<T>) : undefined;
}

/** The top-left corner of the payload's nodes: the least x and the least y of their positions. */
export function cornerOf<T extends FlowTypes>(payload: Payload<T>): XY {
    return {
        x: Math.min(...payload.nodes.map((node) => node.position.x)),
        y: Math.min(...payload.nodes.map((node) => node.position.y)),
    };
}

/**
 * Where the pastes stand, counted apart at the copy's place and at the pointer, so one never
 * restarts the other: the next paste's step (how many `OFFSET`s it moves) at the copy's place,
 * and at `pointer`, the pointer the last paste under the pointer went to.
 */
export interface Cascade {
    readonly atCopy: number;
    readonly atPointer: number;
    readonly pointer?: XY | undefined;
}

/** After a copy the first paste is one step away; after a cut it goes back where the nodes were. */
export const afterCopy: Cascade = { atCopy: 1, atPointer: 0 };
export const afterCut: Cascade = { atCopy: 0, atPointer: 0 };

const samePoint = (a: XY | undefined, b: XY | undefined) =>
    a !== undefined && b !== undefined && a.x === b.x && a.y === b.y;

/**
 * The step of a paste at `pointer` (flow coordinates; none: not over the flow), and the cascade
 * after it. A paste at no pointer moves one step further from the copy's place than the last one
 * there; a paste where the last paste under the pointer went moves one step further than it; a
 * paste at a new pointer starts again on it.
 */
export function cascade(
    current: Cascade,
    pointer: XY | undefined,
): { step: number; next: Cascade } {
    if (pointer === undefined) {
        const step = current.atCopy;
        return { step, next: { ...current, atCopy: step + 1 } };
    }
    const step = samePoint(pointer, current.pointer) ? current.atPointer : 0;
    return { step, next: { ...current, atPointer: step + 1, pointer } };
}

/**
 * How far a paste moves the payload's nodes: `step` offsets, from the pointer (their top-left
 * corner lands on it) or from where they were copied.
 */
export function shiftFor<T extends FlowTypes>(
    payload: Payload<T>,
    step: number,
    pointer: XY | undefined,
): XY {
    const corner = cornerOf(payload);
    const from = pointer
        ? { x: pointer.x - corner.x, y: pointer.y - corner.y }
        : { x: 0, y: 0 };
    return { x: from.x + step * OFFSET, y: from.y + step * OFFSET };
}

/** An id the flow does not hold: the copied one's stem with the least free number (`b-2`, `b-3`). */
function freeId(id: string, taken: Set<string>): string {
    const stem = id.replace(/-\d+$/, "");
    let n = 2;
    while (taken.has(`${stem}-${n}`)) n += 1;
    const free = `${stem}-${n}`;
    taken.add(free);
    return free;
}

/**
 * The payload's nodes and edges as a paste adds them: each with an id none of `taken` (the flow's
 * ids) has, the edges joining the new nodes, and every node moved by `shift`.
 */
export function pasted<T extends FlowTypes>(
    payload: Payload<T>,
    taken: Iterable<string>,
    shift: XY,
): { nodes: FlowNode<T>[]; edges: FlowEdge<T>[] } {
    const used = new Set(taken);
    const ids = new Map<string, string>();
    const nodes = payload.nodes.map((node) => {
        const id = freeId(node.id, used);
        ids.set(node.id, id);
        return {
            ...node,
            id,
            position: {
                x: node.position.x + shift.x,
                y: node.position.y + shift.y,
            },
        };
    });
    const edges = payload.edges.map((edge) => ({
        ...edge,
        id: freeId(edge.id, used),
        source: ids.get(edge.source) ?? edge.source,
        target: ids.get(edge.target) ?? edge.target,
    }));
    return { nodes, edges };
}
