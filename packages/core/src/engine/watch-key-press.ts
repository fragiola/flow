// Whether keys are held, for the adapters' `useKeyPress` (and its composable, rune and injection
// function): one matcher in the core, so the four adapters agree on the combo syntax. It listens
// to the target it is given (the root's window by default in the adapters), never to a global.

/**
 * The keys `watchKeyPress` waits for: a combo, or several (any of them). A combo is key names
 * joined by `+`, all held at once: `"Shift"`, `"Meta+s"`, `"Control+Shift+z"`. A name is a
 * `KeyboardEvent.key` (`"a"`, `"Shift"`, `"Delete"`, `" "` for Space) or a `KeyboardEvent.code`
 * (`"KeyA"`, `"Space"`), compared without case.
 */
export type KeyPressKeys = string | readonly string[];

/** What `watchKeyPress` listens to: a window, a document or an element. */
export interface KeyPressTarget {
    addEventListener(
        type: string,
        listener: (event: Event) => void,
        options?: boolean | AddEventListenerOptions,
    ): void;
    removeEventListener(
        type: string,
        listener: (event: Event) => void,
        options?: boolean | EventListenerOptions,
    ): void;
}

/** The combos of `keys`, each a list of lowercase key names. */
function combosOf(keys: KeyPressKeys): string[][] {
    const list = typeof keys === "string" ? [keys] : [...keys];
    return list
        .map((combo) =>
            (combo === "+" ? ["+"] : combo.split("+"))
                .map((name) => (name === "" ? "" : name.toLowerCase()))
                .filter((name) => name !== ""),
        )
        .filter((combo) => combo.length > 0);
}

/** The window a target belongs to (itself when it is one), for its `blur`. */
function viewOf(target: KeyPressTarget): KeyPressTarget | undefined {
    const owner = target as {
        defaultView?: KeyPressTarget | null;
        ownerDocument?: { defaultView?: KeyPressTarget | null } | null;
    };
    if (owner.defaultView) return owner.defaultView;
    if (owner.ownerDocument)
        return owner.ownerDocument.defaultView ?? undefined;
    return target;
}

/**
 * Calls `onChange(pressed)` whenever one of the combos of `keys` starts or stops being held,
 * reading `keydown` and `keyup` on `target` (a window, a document or an element). The keys held
 * are forgotten when the target's window loses focus, and when Meta is released (its platform
 * swallows the other keys' `keyup` while it is held). Returns the function that stops listening.
 */
export function watchKeyPress(
    target: KeyPressTarget,
    keys: KeyPressKeys,
    onChange: (pressed: boolean) => void,
): () => void {
    const combos = combosOf(keys);
    // each physical key held (its `code`, else its `key`) with the names it was pressed as: its
    // release forgets them, though its `key` changed meanwhile (Shift released before `!`)
    const held = new Map<string, readonly string[]>();
    let pressed = false;
    const update = () => {
        const names = new Set([...held.values()].flat());
        const now = combos.some((combo) =>
            combo.every((name) => names.has(name)),
        );
        if (now === pressed) return;
        pressed = now;
        onChange(now);
    };
    const physical = (event: KeyboardEvent) =>
        (event.code || event.key || "").toLowerCase();
    const down = (event: Event) => {
        const key = event as KeyboardEvent;
        held.set(
            physical(key),
            [key.key, key.code]
                .filter((name) => typeof name === "string" && name !== "")
                .map((name) => name.toLowerCase()),
        );
        update();
    };
    const up = (event: Event) => {
        const key = event as KeyboardEvent;
        if (key.key === "Meta") held.clear();
        else held.delete(physical(key));
        update();
    };
    const reset = () => {
        held.clear();
        update();
    };
    const view = viewOf(target);
    target.addEventListener("keydown", down);
    target.addEventListener("keyup", up);
    view?.addEventListener("blur", reset);
    return () => {
        target.removeEventListener("keydown", down);
        target.removeEventListener("keyup", up);
        view?.removeEventListener("blur", reset);
    };
}
