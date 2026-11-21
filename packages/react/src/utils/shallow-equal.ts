// From Splitter (fragiola/splitter, packages/react/src/utils/shallow-equal.ts), same author and
// licence; nested records compared one level down (a part's attributes, its rect).

function same(a: unknown, b: unknown): boolean {
    if (Object.is(a, b)) return true;
    if (
        typeof a !== "object" ||
        typeof b !== "object" ||
        a === null ||
        b === null ||
        Array.isArray(a) !== Array.isArray(b)
    ) {
        return false;
    }
    const aRecord = a as Readonly<Record<string, unknown>>;
    const bRecord = b as Readonly<Record<string, unknown>>;
    const keys = Object.keys(aRecord);
    return (
        keys.length === Object.keys(bRecord).length &&
        keys.every(
            (key) =>
                Object.hasOwn(bRecord, key) &&
                Object.is(aRecord[key], bRecord[key]),
        )
    );
}

/**
 * Whether two records (a part's state) hold the same values, a nested record or array compared by
 * its own entries: what decides that a part does not re-render.
 */
export function shallowEqual(
    a: Readonly<Record<string, unknown>> | undefined,
    b: Readonly<Record<string, unknown>> | undefined,
): boolean {
    if (a === b) return true;
    if (!a || !b) return false;
    const keys = Object.keys(a);
    return (
        keys.length === Object.keys(b).length &&
        keys.every((key) => Object.hasOwn(b, key) && same(a[key], b[key]))
    );
}
