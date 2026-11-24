// A root's listeners (#54, React's `tests/flow-store.test.tsx`): an app-owned model outlives its
// roots, so a root keeps no listener on it once unmounted (one kept holds the root's store and
// its destroyed engine: React leaked one per StrictMode mount), and the engine it created is
// destroyed with every listener the root gave it. Mounting and unmounting again and again comes
// back to the model's baseline.
import {
    createFlowModel,
    type FlowEngine,
    type FlowEngineOptions,
    type FlowModel,
} from "@fragiola/flow";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TestFlow from "./fixtures/test-flow.svelte";
import { installLayout, render, settle, task } from "./flow";

/** Each engine a root created: its live listeners (`subscribe`, `adapter.subscribe`), destroyed. */
interface Created {
    live: { subscribe: number; adapter: number };
    destroyed: boolean;
}
const created = vi.hoisted((): Created[] => []);

/** A listener function counted while live: `live()` adds one, the remover takes it back once. */
function counted<L>(
    subscribe: (listener: L) => () => void,
    count: (delta: number) => void,
): (listener: L) => () => void {
    return (listener) => {
        count(1);
        const stop = subscribe(listener);
        let stopped = false;
        return () => {
            if (stopped) return;
            stopped = true;
            count(-1);
            stop();
        };
    };
}

vi.mock("@fragiola/flow", async (importOriginal) => {
    const core = await importOriginal<typeof import("@fragiola/flow")>();
    return {
        ...core,
        createFlowEngine(model: FlowModel, options: FlowEngineOptions) {
            const engine = core.createFlowEngine(model, options) as FlowEngine;
            const entry: Created = {
                live: { subscribe: 0, adapter: 0 },
                destroyed: false,
            };
            created.push(entry);
            const adapter = Object.create(engine.adapter, {
                subscribe: {
                    value: counted(engine.adapter.subscribe, (delta) => {
                        entry.live.adapter += delta;
                    }),
                },
            });
            // the engine is frozen (bound verbs): a wrapper inherits it
            return Object.create(engine, {
                subscribe: {
                    value: counted(engine.subscribe, (delta) => {
                        entry.live.subscribe += delta;
                    }),
                },
                adapter: { value: adapter },
                destroy: {
                    value: () => {
                        entry.destroyed = true;
                        engine.destroy();
                    },
                },
            });
        },
    };
});

beforeEach(() => {
    installLayout();
    created.length = 0;
});

/** A model of two nodes, and how many of its listeners are live. */
function countedModel(): { model: FlowModel; live: () => number } {
    const real = createFlowModel({
        version: 1,
        nodes: [task("a", 0, 0), task("b", 300, 0)],
        edges: [{ id: "ab", source: "a", target: "b" }],
    });
    let live = 0;
    const model: FlowModel = Object.create(real, {
        subscribe: {
            value: counted(real.subscribe, (delta) => {
                live += delta;
            }),
        },
    });
    return { model, live: () => live };
}

const nodeCount = () =>
    document.querySelectorAll('[data-flow-part="node"]').length;

describe("an app-owned model given to a root", () => {
    it("has no listener of the root left after its unmount, and the root's engine none of its own", async () => {
        const { model, live } = countedModel();
        const baseline = live();
        const view = await render(TestFlow, { model });
        expect(live()).toBeGreaterThan(baseline);
        expect(created).toHaveLength(1);
        const [engine] = created as [Created];
        expect(engine.live.adapter).toBeGreaterThan(0);
        expect(engine.live.subscribe).toBeGreaterThan(0);
        view.unmount();
        await settle();
        expect(live()).toBe(baseline);
        expect(engine).toEqual({
            live: { subscribe: 0, adapter: 0 },
            destroyed: true,
        });
    });

    it("comes back to its baseline after each of several mounts, each listening as much", async () => {
        const { model, live } = countedModel();
        const baseline = live();
        const mounted: number[] = [];
        const after: number[] = [];
        for (let i = 0; i < 5; i++) {
            const view = await render(TestFlow, { model });
            mounted.push(live());
            view.unmount();
            await settle();
            after.push(live());
        }
        expect(after).toEqual(Array.from({ length: 5 }, () => baseline));
        expect(new Set(mounted).size).toBe(1);
        expect(created).toHaveLength(5);
        for (const engine of created) {
            expect(engine).toEqual({
                live: { subscribe: 0, adapter: 0 },
                destroyed: true,
            });
        }
    });

    it("shows a change made while unmounted on the next mount, and one made while mounted", async () => {
        const { model } = countedModel();
        const first = await render(TestFlow, { model });
        expect(nodeCount()).toBe(2);
        first.unmount();
        await settle();
        model.run("node.add", task("c", 0, 400));
        await render(TestFlow, { model });
        expect(nodeCount()).toBe(3);
        model.run("node.add", task("d", 0, 600));
        await settle();
        expect(nodeCount()).toBe(4);
    });
});
