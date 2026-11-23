// The hooks and helpers only the primitives call.
import * as React from "react";
import type { AnyFlowEngine, AnyFlowModel } from "../context";
import {
    type FlowStore,
    type FlowValueScope,
    flowStoreOf,
} from "../utils/flow-store";
import { shallowEqual } from "../utils/shallow-equal";

/** @internal `useLayoutEffect` in a browser, nothing on the server (where it would warn) */
export const useIsomorphicLayoutEffect =
    typeof document === "undefined" ? () => {} : React.useLayoutEffect;

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

/**
 * @internal a value read from the model and the engine, re-rendering the component only when it
 * changes (`isEqual`; records by their entries by default). It is read again on every change of
 * the model's lists and every view change of the engine (`engine.adapter`: measurements, the
 * viewport, a gesture) that may concern its `scope` (`entity`: a node's or an edge's own view, not
 * read again on a viewport step), and on every render (the reader may close over props); a value
 * equal to the last one keeps the last object. Every reader of a root shares one subscription
 * (`flowStoreOf`).
 */
export function useFlowValue<S>(
    model: AnyFlowModel,
    engine: AnyFlowEngine | null,
    read: () => S,
    isEqual: (a: S, b: S) => boolean = sameValue,
    scope: FlowValueScope = "view",
): S {
    const latest = React.useRef({ read, isEqual });
    latest.current = { read, isEqual };
    const cache = React.useRef<
        | {
              store: FlowStore;
              version: number;
              read: () => S;
              value: S;
          }
        | undefined
    >(undefined);
    const store = flowStoreOf(model, engine);
    const subscribe = React.useCallback(
        (onChange: () => void) => store.subscribe(scope, onChange),
        [store, scope],
    );
    const getSnapshot = (): S => {
        const version = store.version(scope);
        const previous = cache.current;
        if (
            previous?.store === store &&
            previous.version === version &&
            previous.read === latest.current.read
        ) {
            return previous.value;
        }
        const value = latest.current.read();
        const kept =
            previous !== undefined &&
            latest.current.isEqual(previous.value, value)
                ? previous.value
                : value;
        cache.current = {
            store,
            version,
            read: latest.current.read,
            value: kept,
        };
        return kept;
    };
    return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
