// The selection feature (D2, `@fragiola/flow/selection`): nodes and edges are selected. Its model
// side is here: the `selection.*` commands, the `selected-*` and `*-selected` keys, the `selected`
// field of a node and an edge, and its rule (a node or edge made unselectable is deselected). Its
// engine side (click, modifier multi-select, box selection) comes with the engine
// (fragiola/flow#3), reading `options`.
import { fail } from "../commands/define";
import { edgeFlag, nodeFlag } from "../document/flags";
import type { FlowFeature, FlowReader } from "../features/types";
import { stringOf } from "../state/core-queries";
import { selectionClear, selectionRemove, selectionSet } from "./commands";

/** How a box selection takes nodes: those it touches (`"partial"`) or those it holds whole (`"full"`). */
export type BoxSelectionMode = "partial" | "full";

/** Options of {@link selection}: read by its engine side. */
export interface SelectionOptions {
    /** how a box selection takes nodes; default `"full"` */
    readonly boxMode: BoxSelectionMode;
    /** whether a modifier click (Ctrl/⌘, Shift) adds to the selection; default true */
    readonly multiple: boolean;
}

/** The selection feature, as `selection()` makes it. */
export type SelectionFeature = FlowFeature<"selection", SelectionOptions>;

const UNSELECTABLE = "is selected, but not selectable";

/** Selecting nodes and edges: `features: [selection()]` (`@fragiola/flow/selection`). */
export function selection(
    options: Partial<SelectionOptions> = {},
): SelectionFeature {
    return Object.freeze({
        name: "selection",
        options: Object.freeze({
            boxMode: options.boxMode ?? "full",
            multiple: options.multiple ?? true,
        }),
        commands: [selectionSet, selectionClear, selectionRemove],
        get: {
            "selected-nodes": (reader: FlowReader) =>
                reader.nodes().filter((node) => node.selected === true),
            "selected-edges": (reader: FlowReader) =>
                reader.edges().filter((edge) => edge.selected === true),
        },
        is: {
            "node-selected": (reader: FlowReader, payload: unknown) => {
                const id = stringOf(payload, "nodeId");
                return id !== undefined && reader.node(id)?.selected === true;
            },
            "edge-selected": (reader: FlowReader, payload: unknown) => {
                const id = stringOf(payload, "edgeId");
                return id !== undefined && reader.edge(id)?.selected === true;
            },
        },
        documentIssues: (reader: FlowReader) => [
            ...reader.nodes().flatMap((node, i) =>
                node.selected === true && !nodeFlag(node, "selectable")
                    ? [
                          {
                              path: `/nodes/${i}/selected`,
                              message: UNSELECTABLE,
                          },
                      ]
                    : [],
            ),
            ...reader.edges().flatMap((edge, i) =>
                edge.selected === true && !edgeFlag(edge, "selectable")
                    ? [
                          {
                              path: `/edges/${i}/selected`,
                              message: UNSELECTABLE,
                          },
                      ]
                    : [],
            ),
        ],
        checkNode: (_draft, node, path) =>
            node.selected === true && !nodeFlag(node, "selectable")
                ? fail("refused", UNSELECTABLE, `${path}/selected`)
                : undefined,
        checkEdge: (_draft, edge, path) =>
            edge.selected === true && !edgeFlag(edge, "selectable")
                ? fail("refused", UNSELECTABLE, `${path}/selected`)
                : undefined,
        flagsChanged: (draft, kind, id) => {
            if (kind === "node") {
                const node = draft.node(id);
                if (node?.selected === true && !nodeFlag(node, "selectable")) {
                    const { selected: _was, ...rest } = node;
                    draft.putNode(rest as typeof node);
                }
            } else {
                const edge = draft.edge(id);
                if (edge?.selected === true && !edgeFlag(edge, "selectable")) {
                    const { selected: _was, ...rest } = edge;
                    draft.putEdge(rest as typeof edge);
                }
            }
        },
    } satisfies SelectionFeature);
}
