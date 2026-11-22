// The selection feature (D2, `@fragiola/flow/selection`): nodes and edges are selected. Its model
// side is here: the `selection.*` commands, the `selected-*` and `*-selected` keys, the `selected`
// field of a node and an edge, and its rule (a node or edge made unselectable is deselected). Its
// engine side (`selection-engine.ts`: click, modifier multi-select, box selection) reads `options`.
import { fail } from "../commands/define";
import { edgeFlag, nodeFlag } from "../document/flags";
import type { FlowFeature, FlowReader } from "../features/types";
import { stringOf } from "../state/core-queries";
import { selectionClear, selectionRemove, selectionSet } from "./commands";
import { selectionEngine } from "./selection-engine";

/** How a box selection takes nodes: those it touches (`"partial"`) or those it holds whole (`"full"`). */
export type BoxSelectionMode = "partial" | "full";

/**
 * A key a gesture reads while it is held (`KeyboardEvent.key` or `.code`; `Meta`, `Control`, `Alt`
 * and `Shift` from the pointer event's flags), several (any of them), or `null` for none.
 */
export type SelectionKey = string | readonly string[] | null;

/** Options of {@link selection}: read by its engine side. */
export interface SelectionOptions {
    /** how a box selection takes nodes; default `"full"` */
    readonly boxMode: BoxSelectionMode;
    /** whether a click with the multi-selection key adds to the selection; default true */
    readonly multiple: boolean;
    /** whether any drag on the pane draws a selection box (instead of panning); default false: the box key + drag */
    readonly boxOnDrag: boolean;
    /**
     * the key that, held, makes a click toggle a node or an edge in the selection; default
     * `["Meta", "Control", "Shift"]`; `null` for none
     */
    readonly multiKey: SelectionKey;
    /** the key that, held, makes a drag on the pane draw a selection box; default `"Shift"`; `null` for none */
    readonly boxKey: SelectionKey;
}

/** The selection feature, as `selection()` makes it. */
export type SelectionFeature = FlowFeature<"selection", SelectionOptions>;

const UNSELECTABLE = "is selected, but not selectable";

/** A key option as given (frozen), or its default when left out. */
function keyOption(
    value: SelectionKey | undefined,
    fallback: SelectionKey,
): SelectionKey {
    const key = value === undefined ? fallback : value;
    return typeof key === "string" || key === null
        ? key
        : Object.freeze([...key]);
}

/** Selecting nodes and edges: `features: [selection()]` (`@fragiola/flow/selection`). */
export function selection(
    options: Partial<SelectionOptions> = {},
): SelectionFeature {
    const resolved: SelectionOptions = Object.freeze({
        boxMode: options.boxMode ?? "full",
        multiple: options.multiple ?? true,
        boxOnDrag: options.boxOnDrag ?? false,
        multiKey: keyOption(options.multiKey, ["Meta", "Control", "Shift"]),
        boxKey: keyOption(options.boxKey, "Shift"),
    });
    return Object.freeze({
        name: "selection",
        options: resolved,
        engine: (host) => selectionEngine(host, resolved),
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
