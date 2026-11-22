// The core's `get` and `is` keys, answered from the committed document. A feature's keys are its
// own (`FlowFeature.get` / `is`); the model asks them through its composed features.
import type { CommandInfo } from "../commands/types";
import { edgeFlag, nodeFlag, reconnectableEnd } from "../document/flags";
import type {
    EdgeFlags,
    FlowDocumentJson,
    FlowEdge,
    FlowNode,
    NodeFlags,
} from "../document/types";
import type { ComposedFeatures } from "../features/registry";
import type { FlowReader } from "../features/types";
import { cloneJson } from "./clone-json";
import { type CommandsToPayload, commandsTo } from "./commands-to";

/** What a key reads: the document, and the model's features and commands. */
export interface QueryContext {
    readonly reader: FlowReader;
    readonly features: ComposedFeatures;
    readonly commands: readonly CommandInfo[];
    /** the fields `edge.add` fills in (`defaultEdgeOptions`) */
    readonly defaultEdge?: Readonly<Record<string, unknown>> | undefined;
}

/** A string field of a payload of unknown shape (a key's payload is not validated). */
export function stringOf(payload: unknown, key: string): string | undefined {
    const value =
        typeof payload === "object" && payload !== null
            ? (payload as Record<string, unknown>)[key]
            : undefined;
    return typeof value === "string" ? value : undefined;
}

/**
 * The nodes at the other end of a node's edges that end at it (`at: "target"`: its incomers) or
 * start from it (`"source"`: its outgoers), in the document's node order, each once. A self loop
 * makes the node its own incomer and outgoer; hidden nodes and edges count (a graph fact, not a
 * view's).
 */
function neighbours(
    reader: FlowReader,
    nodeId: string | undefined,
    at: "source" | "target",
): readonly FlowNode[] {
    if (nodeId === undefined) return [];
    const other = at === "target" ? "source" : "target";
    const ids = new Set<string>();
    for (const edge of reader.edges()) {
        if (edge[at] === nodeId) ids.add(edge[other]);
    }
    return ids.size === 0
        ? []
        : reader.nodes().filter((node) => ids.has(node.id));
}

/** The core's `get` keys. */
export const CORE_GET: Readonly<
    Record<string, (context: QueryContext, payload: unknown) => unknown>
> = {
    "node-by": ({ reader }, payload) => {
        const id = stringOf(payload, "id");
        return id === undefined ? undefined : reader.node(id);
    },
    "edge-by": ({ reader }, payload) => {
        const id = stringOf(payload, "id");
        return id === undefined ? undefined : reader.edge(id);
    },
    "all-nodes": ({ reader }) => reader.nodes(),
    "all-edges": ({ reader }) => reader.edges(),
    "node-edges-by": ({ reader }, payload) => {
        const nodeId = stringOf(payload, "nodeId");
        const handleType = stringOf(payload, "handleType");
        const handleId = stringOf(payload, "handleId");
        const at = (edge: FlowEdge, end: "source" | "target") =>
            edge[end] === nodeId &&
            (handleType === undefined || handleType === end) &&
            (handleId === undefined ||
                edge[end === "source" ? "sourceHandle" : "targetHandle"] ===
                    handleId);
        return reader
            .edges()
            .filter((edge) => at(edge, "source") || at(edge, "target"));
    },
    "connected-edges-by": ({ reader }, payload) => {
        const list =
            typeof payload === "object" && payload !== null
                ? (payload as { nodeIds?: unknown }).nodeIds
                : undefined;
        const ids = new Set(
            Array.isArray(list)
                ? list.filter((id): id is string => typeof id === "string")
                : [],
        );
        return reader
            .edges()
            .filter((edge) => ids.has(edge.source) || ids.has(edge.target));
    },
    "incomers-by": ({ reader }, payload) =>
        neighbours(reader, stringOf(payload, "nodeId"), "target"),
    "outgoers-by": ({ reader }, payload) =>
        neighbours(reader, stringOf(payload, "nodeId"), "source"),
    "absolute-position-by": ({ reader, features }, payload) => {
        const nodeId = stringOf(payload, "nodeId");
        const node = nodeId === undefined ? undefined : reader.node(nodeId);
        return node && features.absolutePosition(reader, node);
    },
    "flow-json": ({ reader }): FlowDocumentJson =>
        cloneJson({
            version: 1,
            nodes: [...reader.nodes()],
            edges: [...reader.edges()],
        }),
    commands: ({ commands }) => commands,
    "commands-to": (context, payload) => {
        const { reader, commands } = context;
        const target = (
            typeof payload === "object" && payload !== null ? payload : {}
        ) as CommandsToPayload;
        return commandsTo(
            reader,
            {
                nodes: Array.isArray(target.nodes) ? target.nodes : undefined,
                edges: Array.isArray(target.edges) ? target.edges : undefined,
            },
            new Set(commands.map((command) => command.name)),
            context.defaultEdge,
        );
    },
};

function nodeAsks(flag: keyof NodeFlags) {
    return ({ reader }: QueryContext, payload: unknown): boolean => {
        const nodeId = stringOf(payload, "nodeId");
        const node = nodeId === undefined ? undefined : reader.node(nodeId);
        return node !== undefined && nodeFlag(node, flag);
    };
}

function edgeAsks(flag: keyof EdgeFlags) {
    return ({ reader }: QueryContext, payload: unknown): boolean => {
        const edgeId = stringOf(payload, "edgeId");
        const edge = edgeId === undefined ? undefined : reader.edge(edgeId);
        return edge !== undefined && edgeFlag(edge, flag);
    };
}

/** The core's `is` keys: a missing node or edge answers `false`. */
export const CORE_IS: Readonly<
    Record<string, (context: QueryContext, payload: unknown) => boolean>
> = {
    "node-draggable": nodeAsks("draggable"),
    "node-selectable": nodeAsks("selectable"),
    "node-connectable": nodeAsks("connectable"),
    "node-deletable": nodeAsks("deletable"),
    "node-hidden": nodeAsks("hidden"),
    "edge-selectable": edgeAsks("selectable"),
    "edge-deletable": edgeAsks("deletable"),
    "edge-hidden": edgeAsks("hidden"),
    "edge-reconnectable": ({ reader }: QueryContext, payload: unknown) => {
        const edgeId = stringOf(payload, "edgeId");
        const edge = edgeId === undefined ? undefined : reader.edge(edgeId);
        if (edge === undefined) return false;
        const end = stringOf(payload, "end");
        return end === "source" || end === "target"
            ? reconnectableEnd(edge, end)
            : edgeFlag(edge, "reconnectable");
    },
};
