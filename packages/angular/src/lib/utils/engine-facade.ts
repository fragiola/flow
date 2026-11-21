// From packages/react/src/utils/engine-facade.ts (as packages/vue's and packages/svelte's): the same
// facade, framework-free. The engine an app sees through `injectFlow()`, the root
// (`#flow="flowRoot"`) and a flow ref: always there, even before the root created its engine (the
// first render), and the same object when the root replaces it (another model). It forwards every
// verb to the root's current engine; with none, an action is refused and a read gives the empty
// answer.
import type {
    CommandResult,
    FlowEngine,
    FlowEngineAdapter,
    FlowEngineEvent,
    Viewport,
} from "@fragiola/flow";

/** The facade, and how the root points it at its current engine. */
export interface EngineFacade {
    readonly engine: FlowEngine;
    /** the root's current engine (null: not mounted) */
    readonly current: FlowEngine | null;
    /** points the facade at `engine` (null: the root unmounted) */
    set(engine: FlowEngine | null): void;
}

const NOT_MOUNTED: CommandResult<never> = Object.freeze({
    ok: false,
    error: Object.freeze({
        code: "refused",
        message: "the flow is not mounted",
    }),
});

type Verb = (key: string, payload?: unknown) => unknown;

/**
 * A facade whose reads before the mount answer `viewport` with `initial()` (Angular reads it when
 * asked: the root's inputs are set after the facade is made).
 */
export function createEngineFacade(initial: () => Viewport): EngineFacade {
    let current: FlowEngine | null = null;
    const listeners = new Set<(event: FlowEngineEvent) => void>();
    let unsubscribe: () => void = () => {};
    const empty: Readonly<Record<string, unknown>> = {
        get viewport() {
            return Object.freeze({ ...initial() });
        },
        "root-size": Object.freeze({ width: 0, height: 0 }),
        "handles-by": Object.freeze([]),
        "dragging-node-ids": Object.freeze([]),
        "selection-box": null,
        connection: null,
    };
    const forward =
        (verb: "run" | "can" | "check" | "get" | "is", fallback: Verb) =>
        (key: string, payload?: unknown) =>
            current
                ? (current[verb] as unknown as Verb)(key, payload)
                : fallback(key, payload);
    const engine = Object.freeze({
        run: forward("run", () => NOT_MOUNTED),
        can: forward("can", () => false),
        check: forward("check", () => NOT_MOUNTED),
        get: forward("get", (key) =>
            Object.hasOwn(empty, key) ? empty[key] : undefined,
        ),
        is: forward("is", () => false),
        // listens across engines: a listener added before the mount hears the mounted engine
        subscribe(listener: (event: FlowEngineEvent) => void) {
            const wrapper = (event: FlowEngineEvent) => listener(event);
            listeners.add(wrapper);
            return () => {
                listeners.delete(wrapper);
            };
        },
        // the root owns its engine and destroys it when it unmounts
        destroy() {},
        get adapter(): FlowEngineAdapter {
            if (!current) throw new Error("the flow is not mounted");
            return current.adapter;
        },
    }) as unknown as FlowEngine;
    return {
        engine,
        get current() {
            return current;
        },
        set(next) {
            if (next === current) return;
            unsubscribe();
            current = next;
            unsubscribe = next
                ? next.subscribe((event) => {
                      for (const listener of [...listeners]) listener(event);
                  })
                : () => {};
        },
    };
}
