// Whether a value is a node or an edge of a flow, by its shape: a node has an id and a position
// and no ends; an edge has an id, a source and a target. They tell the two apart in a mixed list
// (a selection, a context menu's target), not a full validation (`validateFlow` is that).
import type { AnyTypes, FlowEdge, FlowNode, FlowTypes } from "./types";

const recordOf = (value: unknown): Record<string, unknown> | undefined =>
    value !== null && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : undefined;

/** Whether `value` has a node's shape: a string `id`, a `position` point, no `source` or `target`. */
export function isNode<T extends FlowTypes = AnyTypes>(
    value: unknown,
): value is FlowNode<T> {
    const record = recordOf(value);
    const position = recordOf(record?.position);
    return (
        record !== undefined &&
        typeof record.id === "string" &&
        typeof position?.x === "number" &&
        typeof position.y === "number" &&
        !("source" in record) &&
        !("target" in record)
    );
}

/** Whether `value` has an edge's shape: a string `id`, `source` and `target`. */
export function isEdge<T extends FlowTypes = AnyTypes>(
    value: unknown,
): value is FlowEdge<T> {
    const record = recordOf(value);
    return (
        record !== undefined &&
        typeof record.id === "string" &&
        typeof record.source === "string" &&
        typeof record.target === "string"
    );
}
