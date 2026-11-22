// The keyboard feature (D2, `@fragiola/flow/keyboard`): focus moves through nodes and edges, the
// arrows move the selected nodes (`node.move`), the delete keys (Delete and Backspace by default)
// remove the selection (`selection.remove`), Escape ends what is under way. Its model side is the core's and the
// selection's commands; its engine side (`keyboard-engine.ts`) reads `options`.
import type { FlowFeature } from "../features/types";
import { keyboardEngine } from "./keyboard-engine";

/** Options of {@link keyboard}: read by its engine side. */
export interface KeyboardOptions {
    /** how far an arrow moves a node, in flow units; default 5 */
    readonly step: number;
    /** how far Shift with an arrow moves it; default 20 */
    readonly fastStep: number;
    /**
     * the keys that remove the selection (`KeyboardEvent.key` or `.code`); default
     * `["Delete", "Backspace"]`; `[]` for none
     */
    readonly deleteKeys: readonly string[];
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
    });
    return Object.freeze({
        name: "keyboard",
        options: resolved,
        engine: (host) => keyboardEngine(host, resolved),
    } satisfies KeyboardFeature);
}
