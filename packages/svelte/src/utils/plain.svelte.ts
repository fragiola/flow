// What the app gives, as the core takes it: plain data, never a Svelte proxy (S4). A list the app
// keeps in a deep `$state` is a proxy; the model holds frozen plain data, and a frozen list or
// entry (the model's own, written back to `bind:nodes`) is taken as it is.

/** A value the app owns, without its proxy (a frozen value is taken as it is). */
export function plain<V>(value: V): V {
    return value !== null &&
        typeof value === "object" &&
        !Object.isFrozen(value)
        ? ($state.snapshot(value) as V)
        : value;
}

/** A list the app owns, as the model takes it: plain entries, the frozen ones shared. */
export function plainList<E extends object>(
    list: readonly E[] | undefined,
): readonly E[] | undefined {
    if (list === undefined) return undefined;
    return Object.isFrozen(list) ? list : list.map((entry) => plain(entry));
}

/** Warns once per message and root: misuse that the root ignores. */
export function warnOnce(): (message: string) => void {
    const warned = new Set<string>();
    return (message) => {
        if (warned.has(message)) return;
        warned.add(message);
        console.warn(`[@fragiola/flow-svelte] ${message}`);
    };
}
