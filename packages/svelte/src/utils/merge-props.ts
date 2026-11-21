// The React adapter's (packages/react/src/utils/merge-props.ts, itself from Dockable), for Svelte's
// props: handlers are `on<event>` (`onclick`), the class may be any of Svelte's forms, and an
// attachment is a symbol-keyed prop (`{@attach …}` on a component), kept beside the primitive's.
type AnyProps = Record<string | symbol, unknown>;

function isHandler(
    key: string | symbol,
    value: unknown,
): value is (...args: unknown[]) => void {
    return (
        typeof key === "string" &&
        /^on[a-z]/.test(key) &&
        typeof value === "function"
    );
}

/**
 * Merges `external` props over `internal` ones: plain props from `external` win, event handlers
 * are composed (internal first, then external), classes are joined, and symbol-keyed props
 * (attachments) of both are kept.
 */
export function mergeProps(internal: AnyProps, external: AnyProps): AnyProps {
    const merged: AnyProps = { ...internal };
    for (const key of Reflect.ownKeys(external)) {
        const value = external[key];
        const current = merged[key];
        if (value === undefined) {
            continue;
        }
        if (isHandler(key, value) && isHandler(key, current)) {
            merged[key] = (...args: unknown[]) => {
                current(...args);
                value(...args);
            };
        } else if (key === "class" && current !== undefined) {
            merged.class = [current, value];
        } else {
            merged[key] = value;
        }
    }
    return merged;
}
