// What the directives and the injection functions share: a value read from the model and the
// engine (packages/react's `useFlowValue`, as a computed signal), the inputs a part reads before
// Angular sets them, and the node or edge a part belongs to.
import {
    afterNextRender,
    computed,
    isSignal,
    type Signal,
} from "@angular/core";
import type { EdgeContext, FlowContext, NodeContext } from "../context";
import { beforeInputs } from "../utils/helpers";
import { shallowEqual } from "../utils/shallow-equal";

/** Two values the same for re-rendering: records compared by their entries, arrays by their items. */
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
 * A value read from the model and the engine, as a signal that changes only when the value does
 * (`equal`; records by their entries by default): it is read again on every commit of the model,
 * every view change of the engine (measurements, the viewport, a gesture) and every change of a
 * signal `read` reads (an input), and a value equal to the last one keeps the last object, so
 * nothing that reads it updates.
 */
export function flowValue<S>(
    context: FlowContext,
    read: () => S,
    equal: (a: S, b: S) => boolean = sameValue,
): Signal<S> {
    return computed(
        () => {
            context.revision();
            return read();
        },
        { equal },
    );
}

/** A value an injection function takes: a signal (an input), a getter, or the value itself. */
export type ValueOrSignal<T> = T | Signal<T> | (() => T);

/**
 * The value now, read in a reactive context (a signal or a getter is followed); `undefined` while
 * it is a required input Angular has not set yet.
 */
export function valueNow<T>(value: ValueOrSignal<T>): T | undefined {
    return isSignal(value) || typeof value === "function"
        ? beforeInputs(undefined, value as () => T)
        : value;
}

/**
 * The id of the node (or edge) a part belongs to: its own input, else the enclosing one's. A part
 * with neither is reported once rendered (React's "must be rendered inside Flow.Node"), unless
 * `needed` answers false then (a toolbar of several nodes needs no node).
 */
export function partOwnerId(
    part: string,
    own: () => string | undefined,
    around: NodeContext | EdgeContext | null,
    kind: "node" | "edge",
    needed: () => boolean = () => true,
): Signal<string | undefined> {
    const id = computed(() => {
        const given = beforeInputs(undefined, own);
        if (given !== undefined) return given;
        if (!around) return undefined;
        return "nodeId" in around ? around.nodeId() : around.edgeId();
    });
    afterNextRender(() => {
        if (id() === undefined && needed()) {
            const where = kind === "node" ? "[flowNode]" : "[flowEdge]";
            const input = kind === "node" ? "nodeId" : "edgeId";
            throw new Error(
                `${part} must be used inside ${where} (or be given a ${input})`,
            );
        }
    });
    return id;
}
