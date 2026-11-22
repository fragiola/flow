// The keyboard feature (D2, `@fragiola/flow/keyboard`): focus moves through nodes and edges, the
// arrows move the selected nodes (`node.move`), the delete keys (Delete and Backspace by default)
// remove the selection (`selection.remove`), Escape ends what is under way. Its model side is the core's and the
// selection's commands; its engine side (`keyboard-engine.ts`) reads `options`.
import type { FlowEdge, FlowNode } from "../document/types";
import type { FlowFeature } from "../features/types";
import { keyboardEngine } from "./keyboard-engine";

/** What a `beforeDelete` decides: all (`true`), none (`false`), or only some of them. */
export type DeleteDecision =
    | boolean
    | {
          readonly nodes: readonly FlowNode[];
          readonly edges: readonly FlowEdge[];
      };

/**
 * Asked before a delete key removes anything, with the nodes and edges it would remove (a removed
 * node's edges among them): its answer, or a promise of it, decides what goes.
 */
export type BeforeDelete = (
    nodes: readonly FlowNode[],
    edges: readonly FlowEdge[],
) => DeleteDecision | Promise<DeleteDecision>;

/** Options of {@link keyboard}: read by its engine side. */
export interface KeyboardOptions {
    /**
     * how far an arrow moves a node (or, with `resize()`, a focused resize handle's sides), in
     * flow units; default 5
     */
    readonly step: number;
    /** how far Shift with an arrow moves it (or the sides); default 20 */
    readonly fastStep: number;
    /**
     * the keys that remove the selection (`KeyboardEvent.key` or `.code`); default
     * `["Delete", "Backspace"]`; `[]` for none
     */
    readonly deleteKeys: readonly string[];
    /** a node that takes focus is panned into view when it is not wholly in it; default true */
    readonly panOnFocus: boolean;
    /**
     * asked before a delete key removes anything: `true` removes all, `false` nothing, a
     * `{ nodes, edges }` subset only those; a promise waits (the key is taken at once), and when it
     * settles only what is still there goes; default none: everything goes
     */
    readonly beforeDelete: BeforeDelete | undefined;
}

/** The keyboard feature, as `keyboard()` makes it. */
export type KeyboardFeature = FlowFeature<"keyboard", KeyboardOptions>;

/** Keyboard access to nodes and edges: `features: [keyboard()]` (`@fragiola/flow/keyboard`). */
export function keyboard(
    options: Partial<KeyboardOptions> = {},
): KeyboardFeature {
    const resolved: KeyboardOptions = Object.freeze({
        step: options.step ?? 5,
        fastStep: options.fastStep ?? 20,
        deleteKeys: Object.freeze([
            ...(options.deleteKeys ?? ["Delete", "Backspace"]),
        ]),
        panOnFocus: options.panOnFocus ?? true,
        beforeDelete: options.beforeDelete,
    });
    return Object.freeze({
        name: "keyboard",
        options: resolved,
        engine: (host) => keyboardEngine(host, resolved),
    } satisfies KeyboardFeature);
}
