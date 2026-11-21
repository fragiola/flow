/** A deep, writable copy of a JSON value (what the model stores from a payload, what it writes out). */
export function cloneJson<V>(value: V): V {
    if (Array.isArray(value)) {
        return value.map(cloneJson) as V;
    }
    if (typeof value === "object" && value !== null) {
        const copy: Record<string, unknown> = {};
        for (const [key, child] of Object.entries(value)) {
            if (child !== undefined) {
                // defined, not assigned: a `__proto__` key of parsed JSON stays a plain key
                Object.defineProperty(copy, key, {
                    value: cloneJson(child),
                    enumerable: true,
                    writable: true,
                    configurable: true,
                });
            }
        }
        return copy as V;
    }
    return value;
}
