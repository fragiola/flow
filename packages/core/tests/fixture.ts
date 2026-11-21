// Shared fixtures: small documents the tests load.
import type { FlowJson } from "../src/document/types";

/** A node of type `task` at a position. */
export function task(id: string, x = 0, y = 0, extra: object = {}) {
    return { id, type: "task", position: { x, y }, data: {}, ...extra };
}

/** Three nodes, `a` → `b` → `c`, and their two edges `ab`, `bc`. */
export function chain(): FlowJson {
    return {
        version: 1,
        nodes: [task("a"), task("b", 200), task("c", 400)],
        edges: [
            { id: "ab", source: "a", target: "b" },
            { id: "bc", source: "b", target: "c" },
        ],
    };
}
