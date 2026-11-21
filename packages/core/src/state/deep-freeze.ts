/** Freezes a JSON value and everything in it (already frozen parts are skipped, they are shared). */
export function deepFreeze<V>(value: V): V {
    if (
        typeof value === "object" &&
        value !== null &&
        !Object.isFrozen(value)
    ) {
        Object.freeze(value);
        for (const child of Object.values(value)) {
            deepFreeze(child);
        }
    }
    return value;
}
