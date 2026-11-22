import {
    type KeyPressKeys,
    type KeyPressTarget,
    watchKeyPress,
} from "@fragiola/flow";
import * as React from "react";
import { FlowContext } from "../context";

export interface UseKeyPressOptions {
    /** where the keys are read: a window, a document or an element; default the root's window */
    target?: KeyPressTarget | null | undefined;
}

/**
 * Whether a key, or a combo of keys, is held, re-rendering the component when that changes.
 * `keys` is a combo or several (any of them): key names joined by `+`, held at once (`"Shift"`,
 * `"Meta+s"`, `["Meta+z", "Control+z"]`); a name is a `KeyboardEvent.key` or `.code`, without case
 * (`watchKeyPress`). The keys are read on `target`, by default the window of the enclosing
 * `Flow.Root`'s element (never the global one): false before the root is mounted, or outside a
 * root without a `target`.
 */
export function useKeyPress(
    keys: KeyPressKeys,
    options: UseKeyPressOptions = {},
): boolean {
    const rootElement = React.useContext(FlowContext)?.rootElement ?? null;
    const target =
        options.target === undefined
            ? (rootElement?.ownerDocument.defaultView ?? null)
            : options.target;
    const [pressed, setPressed] = React.useState(false);
    // an equal list of keys on each render keeps the listener (and what it holds)
    const combos = JSON.stringify(typeof keys === "string" ? [keys] : keys);
    React.useEffect(() => {
        if (!target) return;
        const stop = watchKeyPress(
            target,
            JSON.parse(combos) as string[],
            setPressed,
        );
        return () => {
            stop();
            setPressed(false);
        };
    }, [target, combos]);
    return pressed;
}
