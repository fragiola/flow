// The reactive helpers only the primitives call.
import type { FlowContextValue } from "../context.js";
import { shallowEqual } from "../utils/shallow-equal.js";

/** @internal two values the same for re-rendering: records compared by their entries */
export function sameValue<S>(a: S, b: S): boolean {
    if (Object.is(a, b)) return true;
    if (
        typeof a === "object" &&
        typeof b === "object" &&
        a !== null &&
        b !== null &&
        !Array.isArray(a) &&
        !Array.isArray(b)
    ) {
        return shallowEqual(
            a as Readonly<Record<string, unknown>>,
            b as Readonly<Record<string, unknown>>,
        );
    }
    if (Array.isArray(a) && Array.isArray(b)) {
        return (
            a.length === b.length &&
            a.every((value, i) => Object.is(value, b[i]))
        );
    }
    return false;
}

/** A value that follows the flow: read it through `current`. */
export interface FlowValue<S> {
    readonly current: S;
}

/**
 * @internal a value read from the model and the engine (the React adapter's `useFlowValue`), as a
 * `$derived` that notifies its readers only when it changes (`isEqual`; records by their entries
 * by default). It is read again on every commit of the model and every view change of the engine
 * (the root's `revision`), when the engine is created, and when a reactive value the reader uses
 * changes (a prop); a value equal to the last one keeps the last object, so nothing re-renders.
 */
export function flowValue<S>(
    context: FlowContextValue,
    read: () => S,
    isEqual: (a: S, b: S) => boolean = sameValue,
): FlowValue<S> {
    let last: { value: S } | undefined;
    const value = $derived.by(() => {
        context.revision;
        context.engine;
        const next = read();
        if (last !== undefined && isEqual(last.value, next)) {
            return last.value;
        }
        last = { value: next };
        return next;
    });
    return {
        get current() {
            return value;
        },
    };
}

/** A value, or a getter of it: what a rune takes to follow a prop (`() => node`). */
export type MaybeGetter<V> = V | (() => V);

/** @internal the value behind a `MaybeGetter` */
export function read<V>(value: MaybeGetter<V>): V {
    return typeof value === "function" ? (value as () => V)() : value;
}
