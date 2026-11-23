// The shared store of a root (Epic #61, #60) listens to an app-owned model only while it has a
// reader: mounting and unmounting a `Flow.Root` (StrictMode included) leaves the model with the
// listeners it had before, so an unmounted root and its destroyed engine are not kept alive.
import { createFlowModel, type FlowModel } from "@fragiola/flow";
import { act, render } from "@testing-library/react";
import * as React from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { installLayout, TestFlow, task } from "./flow";

beforeEach(() => installLayout());

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
            value: (listener: Parameters<FlowModel["subscribe"]>[0]) => {
                live += 1;
                const stop = real.subscribe(listener);
                let stopped = false;
                return () => {
                    if (stopped) return;
                    stopped = true;
                    live -= 1;
                    stop();
                };
            },
        },
    });
    return { model, live: () => live };
}

describe("an app-owned model's listeners", () => {
    for (const strict of [false, true]) {
        it(`return to the baseline after each unmount${strict ? " (StrictMode)" : ""}`, () => {
            const { model, live } = countedModel();
            const baseline = live();
            const Wrap = strict ? React.StrictMode : React.Fragment;
            const mounted: number[] = [];
            const after: number[] = [];
            for (let i = 0; i < 5; i++) {
                const view = render(
                    <Wrap>
                        <TestFlow model={model} />
                    </Wrap>,
                );
                mounted.push(live());
                view.unmount();
                after.push(live());
            }
            expect(after).toEqual([
                baseline,
                baseline,
                baseline,
                baseline,
                baseline,
            ]);
            // a mounted root listens as much each time
            expect(new Set(mounted).size).toBe(1);
        });
    }

    it("a change made while unmounted shows on the next mount", () => {
        const { model } = countedModel();
        const first = render(<TestFlow model={model} />);
        expect(
            document.querySelectorAll("[data-flow-part='node']"),
        ).toHaveLength(2);
        first.unmount();
        model.run("node.add", task("c", 0, 400));
        render(<TestFlow model={model} />);
        expect(
            document.querySelectorAll("[data-flow-part='node']"),
        ).toHaveLength(3);
    });

    it("a change made while mounted still shows", () => {
        const { model } = countedModel();
        render(<TestFlow model={model} />);
        act(() => {
            model.run("node.add", task("c", 0, 400));
        });
        expect(
            document.querySelectorAll("[data-flow-part='node']"),
        ).toHaveLength(3);
    });
});
