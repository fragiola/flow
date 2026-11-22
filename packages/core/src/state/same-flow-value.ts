// Whether two reads of the flow are the same value, for the adapters' hooks: a hook re-renders
// (or a composable, rune or signal changes) only when what it selected changed, and every
// adapter compares the same way.

/** Whether a value is a plain record (`{ … }`): not an array, a class instance or null. */
function plainRecord(
    value: unknown,
): value is Readonly<Record<string, unknown>> {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return false;
    }
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

/**
 * Whether two values read from the model or the engine are the same: the same value
 * (`Object.is`), or arrays of the same values in order, or plain records with the same keys and
 * values, compared all the way down. Anything else (a DOM event, a class instance, a function)
 * is the same only when it is the very same.
 */
export function sameFlowValue(a: unknown, b: unknown): boolean {
    if (Object.is(a, b)) return true;
    if (Array.isArray(a) && Array.isArray(b)) {
        return (
            a.length === b.length &&
            a.every((value, i) => sameFlowValue(value, b[i]))
        );
    }
    if (plainRecord(a) && plainRecord(b)) {
        const keys = Object.keys(a);
        return (
            keys.length === Object.keys(b).length &&
            keys.every(
                (key) => Object.hasOwn(b, key) && sameFlowValue(a[key], b[key]),
            )
        );
    }
    return false;
}
