import {
    type KeyPressKeys,
    type KeyPressTarget,
    watchKeyPress,
} from "@fragiola/flow";
import { findFlowContext } from "../context.js";
import { type FlowValue, type MaybeGetter, read } from "./internal.svelte.js";

export interface UseKeyPressOptions {
    /** where the keys are read: a window, a document or an element; default the root's window */
    target?: KeyPressTarget | null | undefined;
}

/**
 * Whether a key, or a combo of keys, is held, as `current`, which notifies its readers when that
 * changes. `keys` is a combo or several (any of them): key names joined by `+`, held at once
 * (`"Shift"`, `"Meta+s"`, `["Meta+z", "Control+z"]`); a name is a `KeyboardEvent.key` or `.code`,
 * without case (`watchKeyPress`). The keys are read on `target`, by default the window of the
 * enclosing `Flow.Root`'s element (never the global one): false before the root is mounted, or
 * outside a root without a `target`. Pass getters to follow props; it listens again only when
 * the keys (by value) or the target change. Call it in a component's script.
 */
export function useKeyPress(
    keys: MaybeGetter<KeyPressKeys>,
    options: MaybeGetter<UseKeyPressOptions> = {},
): FlowValue<boolean> {
    const context = findFlowContext();
    const target = $derived.by(() => {
        const given = read(options).target;
        return given === undefined
            ? (context?.rootElement?.ownerDocument.defaultView ?? null)
            : given;
    });
    // an equal list of keys keeps the listener (and what it holds)
    const combos = $derived.by(() => {
        const given = read(keys);
        return JSON.stringify(typeof given === "string" ? [given] : given);
    });
    let pressed = $state(false);
    $effect(() => {
        const on = target;
        const list = JSON.parse(combos) as string[];
        if (!on) return;
        const stop = watchKeyPress(on, list, (value) => {
            pressed = value;
        });
        return () => {
            stop();
            pressed = false;
        };
    });
    return {
        get current() {
            return pressed;
        },
    };
}
