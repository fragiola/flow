// A reader of the root's store outside a component (`tests/flow-store.test.ts`): an effect that
// reads the counters of a scope (and of a node or an edge), as a `flowValue` derived does, and
// counts its runs. Runes need a `.svelte.ts` module.
import { flushSync, untrack } from "svelte";
import type {
    FlowEntity,
    FlowStore,
    FlowValueScope,
} from "../../src/utils/flow-store.svelte.js";

export interface Tracker {
    /** how many times the store told it, since it started (its first run not counted) */
    readonly told: number;
    stop(): void;
}

/** Reads `scope`'s counters (and `entity`'s) in an effect, and counts its reruns. */
export function track(
    store: FlowStore,
    scope: FlowValueScope,
    entity?: FlowEntity,
): Tracker {
    let runs = 0;
    const stop = $effect.root(() => {
        $effect.pre(() => {
            store.track(scope, entity);
            untrack(() => {
                runs += 1;
            });
        });
    });
    flushSync();
    return {
        get told() {
            flushSync();
            return runs - 1;
        },
        stop,
    };
}
