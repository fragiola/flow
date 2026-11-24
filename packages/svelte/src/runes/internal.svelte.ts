// The reactive helpers only the primitives call.
import { untrack } from "svelte";
import type { FlowContextValue } from "../context.js";
import type { FlowEntity, FlowValueScope } from "../utils/flow-store.svelte.js";
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
 * @internal what a reader depends on (`flowValue`'s last argument): a scope (`view` by default),
 * and for an `entity` reader of one node or edge, which one (its measurements are told to it alone)
 */
export interface FlowValueOptions {
    readonly scope?: FlowValueScope;
    /** the node or the edge it shows (a getter: another id is followed) */
    readonly entity?: () => FlowEntity;
}

/**
 * @internal a value read from the model and the engine (the React adapter's `useFlowValue`), as a
 * `$derived` that notifies its readers only when it changes (`isEqual`; records by their entries
 * by default). It is read again when the root's store tells its scope (`view`: every commit and
 * view change; `entity`: not a viewport-only one, and a measurement only when it changed its node
 * or edge), when the engine is created, and when a reactive value the reader uses changes (a
 * prop); a value equal to the last one keeps the last object, so nothing re-renders. Called while
 * a component initializes (an `entity` reader keeps its record in the store while mounted).
 */
export function flowValue<S>(
    context: FlowContextValue,
    read: () => S,
    isEqual: (a: S, b: S) => boolean = sameValue,
    options: FlowValueOptions = {},
): FlowValue<S> {
    const scope = options.scope ?? (options.entity ? "entity" : "view");
    const { entity } = options;
    if (entity) {
        // its record, kept while it is mounted (before the deriveds read it: a pre effect runs as
        // the component initializes); another id acquires another one
        $effect.pre(() => {
            const of = entity();
            const store = context.store;
            return untrack(() => store.acquire({ kind: of.kind, id: of.id }));
        });
    }
    let last: { value: S } | undefined;
    const value = $derived.by(() => {
        context.store.track(scope, entity?.());
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
