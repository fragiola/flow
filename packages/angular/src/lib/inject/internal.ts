// What the directives and the injection functions share: a value read from the model and the
// engine (packages/react's `useFlowValue`, as a computed signal), the inputs a part reads before
// Angular sets them, and the node or edge a part belongs to.
import {
    afterNextRender,
    computed,
    DestroyRef,
    inject,
    isSignal,
    type Signal,
    untracked,
} from "@angular/core";
import type { EdgeContext, FlowContext, NodeContext } from "../context";
import {
    entityKey,
    type FlowEntity,
    type FlowValueScope,
} from "../utils/flow-store";
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

/** What a `flowValue` depends on: its scope, and the node or edge it shows */
export interface FlowValueOptions {
    /** `view` (the default): every change; `entity`: a node's or an edge's own view */
    readonly scope?: FlowValueScope;
    /**
     * the node or edge an `entity` reader shows (`undefined` while its input is not set): a
     * measurement tells it only when it changed that node's box or that edge's path. Given, the
     * value is made in an injection context (its record is released on destroy)
     */
    readonly entity?: () => FlowEntity | undefined;
}

/**
 * A value read from the model and the engine, as a signal that changes only when the value does
 * (`equal`; records by their entries by default): it is read again on every commit of the model,
 * every view change of the engine (measurements, the viewport, a gesture) and every change of a
 * signal `read` reads (an input), and a value equal to the last one keeps the last object, so
 * nothing that reads it updates. An `entity` reader (a node's or an edge's own view) is not read
 * again on a viewport-only step, nor on a measurement that did not change its node or edge.
 */
export function flowValue<S>(
    context: FlowContext,
    read: () => S,
    equal: (a: S, b: S) => boolean = sameValue,
    options: FlowValueOptions = {},
): Signal<S> {
    const { store } = context;
    const { scope = "view", entity } = options;
    if (scope === "view") {
        return computed(
            () => {
                store.view();
                return read();
            },
            { equal },
        );
    }
    // the record of the node or edge it reads, held while it reads it (released on destroy)
    let held: { key: string; release: () => void } | undefined;
    if (entity) {
        inject(DestroyRef).onDestroy(() => {
            held?.release();
            held = undefined;
        });
    }
    return computed(
        () => {
            store.entity();
            const of = entity?.();
            if (of) {
                const key = entityKey(of);
                if (held?.key !== key) {
                    held?.release();
                    held = { key, release: untracked(() => store.acquire(of)) };
                }
                store.counterOf(of)();
            } else {
                store.measure();
            }
            return read();
        },
        { equal },
    );
}

/** @internal an `entity` reader's node or edge, from its id (`undefined` while not known) */
export function entityOf(
    kind: FlowEntity["kind"],
    id: () => string | undefined,
): () => FlowEntity | undefined {
    return () => {
        const current = id();
        return current === undefined ? undefined : { kind, id: current };
    };
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
