// The core's `get` and `is` keys, answered from the committed document. A feature's keys are its
// own (`FlowFeature.get` / `is`); the model asks them through its composed features.
import type { CommandInfo } from "../commands/types";
import { edgeFlag, nodeFlag } from "../document/flags";
import type {
    EdgeFlags,
    FlowDocumentJson,
    FlowEdge,
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
}

/** A string field of a payload of unknown shape (a key's payload is not validated). */
export function stringOf(payload: unknown, key: string): string | undefined {
    const value =
        typeof payload === "object" && payload !== null
            ? (payload as Record<string, unknown>)[key]
            : undefined;
    return typeof value === "string" ? value : undefined;
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
    "commands-to": ({ reader, commands }, payload) => {
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
    "edge-reconnectable": edgeAsks("reconnectable"),
};
