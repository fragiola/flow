import {
    computed,
    effect,
    inject,
    type Signal,
    signal,
    untracked,
} from "@angular/core";
import {
    type KeyPressKeys,
    type KeyPressTarget,
    watchKeyPress,
} from "@fragiola/flow";
import { FLOW_CONTEXT } from "../context";
import { type ValueOrSignal, valueNow } from "./internal";

export interface InjectKeyPressOptions {
    /**
     * where the keys are read: a window, a document or an element (`null`: nowhere); default the
     * root's window
     */
    target?: ValueOrSignal<KeyPressTarget | null | undefined>;
}

/**
 * Whether a key, or a combo of keys, is held (React's `useKeyPress`), as a signal. `keys` is a
 * combo or several (any of them): key names joined by `+`, held at once (`"Shift"`, `"Meta+s"`,
 * `["Meta+z", "Control+z"]`); a name is a `KeyboardEvent.key` or `.code`, without case
 * (`watchKeyPress`). The keys are read on `target`, by default the window of the enclosing
 * `[flowRoot]`'s element (never the global one): false outside a root without a `target`. The
 * keys and the target are values, signals or getters. Call it in an injection context (a
 * constructor or a field).
 */
export function injectKeyPress(
    keys: ValueOrSignal<KeyPressKeys>,
    options: InjectKeyPressOptions = {},
): Signal<boolean> {
    const root = inject(FLOW_CONTEXT, { optional: true })?.rootElement ?? null;
    const target = computed((): KeyPressTarget | null => {
        const given =
            options.target === undefined ? undefined : valueNow(options.target);
        if (given !== undefined) return given;
        return root?.ownerDocument.defaultView ?? null;
    });
    // an equal list of keys keeps the listener (and what it holds)
    const combos = computed(
        (): readonly string[] => {
            const now = valueNow(keys);
            return now === undefined
                ? []
                : typeof now === "string"
                  ? [now]
                  : now;
        },
        {
            equal: (a, b) =>
                a.length === b.length && a.every((combo, i) => combo === b[i]),
        },
    );
    const pressed = signal(false);
    effect((onCleanup) => {
        const on = target();
        const list = combos();
        if (!on) return;
        untracked(() => {
            const stop = watchKeyPress(on, list, (now) => pressed.set(now));
            onCleanup(() => {
                stop();
                pressed.set(false);
            });
        });
    });
    return pressed.asReadonly();
}
