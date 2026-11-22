import {
    type KeyPressKeys,
    type KeyPressTarget,
    watchKeyPress,
} from "@fragiola/flow";
import {
    inject,
    type MaybeRefOrGetter,
    type Ref,
    readonly,
    shallowRef,
    toValue,
    watchEffect,
} from "vue";
import { FlowKey } from "../context";

export interface UseKeyPressOptions {
    /** where the keys are read: a window, a document or an element; default the root's window */
    target?: KeyPressTarget | null | undefined;
}

/**
 * Whether a key, or a combo of keys, is held, as a ref that changes with it. `keys` is a combo or
 * several (any of them): key names joined by `+`, held at once (`"Shift"`, `"Meta+s"`,
 * `["Meta+z", "Control+z"]`); a name is a `KeyboardEvent.key` or `.code`, without case
 * (`watchKeyPress`). The keys are read on `target`, by default the window of the enclosing
 * `Flow.Root`'s element (never the global one): false before the root is mounted, or outside a
 * root without a `target`. The keys and the options may be refs or getters.
 */
export function useKeyPress(
    keys: MaybeRefOrGetter<KeyPressKeys>,
    options: MaybeRefOrGetter<UseKeyPressOptions> = {},
): Readonly<Ref<boolean>> {
    const rootElement = inject(FlowKey, null)?.rootElement;
    const pressed = shallowRef(false);
    watchEffect((onCleanup) => {
        const given = toValue(options).target;
        const target =
            given === undefined
                ? (rootElement?.value?.ownerDocument.defaultView ?? null)
                : given;
        if (!target) return;
        const value = toValue(keys);
        const stop = watchKeyPress(
            target,
            typeof value === "string" ? [value] : [...value],
            (held) => {
                pressed.value = held;
            },
        );
        onCleanup(() => {
            stop();
            pressed.value = false;
        });
    });
    return readonly(pressed);
}
