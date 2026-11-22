// The engine options of #23 and #24 as root props, `duration` on the control buttons, and what the
// node and edges parts apply from the core (z-order, node origin): React's
// `tests/options.test.tsx`. The engine is wrapped so the tests see what reaches it: its creation
// options, `adapter.setOptions` and `run`.
import type { FlowEngine, FlowEngineOptions, FlowModel } from "@fragiola/flow";
import { selection } from "@fragiola/flow/selection";
import { subflows } from "@fragiola/flow/subflows";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DRAG_HANDLE_ATTRIBUTE } from "../src/index";
import DurationFlow from "./fixtures/duration-flow.svelte";
import ProbeFlow from "./fixtures/probe-flow.svelte";
import TestFlow from "./fixtures/test-flow.svelte";
import { click, installLayout, part, render, task } from "./flow";

const engines = vi.hoisted(
    () =>
        [] as {
            options: FlowEngineOptions;
            setOptions: ReturnType<typeof vi.fn>;
            run: ReturnType<typeof vi.fn>;
        }[],
);

vi.mock("@fragiola/flow", async (importOriginal) => {
    const core = await importOriginal<typeof import("@fragiola/flow")>();
    return {
        ...core,
        createFlowEngine(model: FlowModel, options: FlowEngineOptions) {
            const engine = core.createFlowEngine(model, options) as FlowEngine;
            const setOptions = vi.fn((next: Partial<FlowEngineOptions>) =>
                engine.adapter.setOptions(next),
            );
            const run = vi.fn((key: string, payload?: unknown) =>
                (engine.run as (k: string, p?: unknown) => unknown)(
                    key,
                    payload,
                ),
            );
            engines.push({ options, setOptions, run });
            // the engine and its adapter are frozen: a wrapper inherits them and overrides two
            const adapter = Object.create(engine.adapter, {
                setOptions: { value: setOptions },
            });
            return Object.create(engine, {
                adapter: { value: adapter },
                run: { value: run },
            });
        },
    };
});

beforeEach(() => {
    installLayout();
    engines.length = 0;
});

const features = [selection(), subflows()] as const;

const ease = (t: number) => t;
const other = (t: number) => t * t;

/** The options of #23 and #24, each away from its default. */
const OPTIONS = {
    autoPan: { speed: 5, margin: 20 },
    panOnDrag: [1, 2],
    panActivationKey: "Shift",
    panOnScrollMode: "horizontal",
    panOnScrollSpeed: 2,
    zoomActivationKey: "Alt",
    easing: ease,
    nodeOrigin: { x: 0.5, y: 0.5 },
    nodeExtent: { x: -100, y: -100, width: 500, height: 500 },
    elevateNodesOnSelect: false,
    elevateEdgesOnSelect: true,
};

const last = () => {
    const engine = engines.at(-1);
    if (!engine) throw new Error("no engine");
    return engine;
};

const byTestId = (container: HTMLElement, id: string) =>
    container.querySelector(`[data-testid="${id}"]`) as HTMLElement;

describe("the viewport and gesture options (#25)", () => {
    it("reach the engine it creates", async () => {
        await render(TestFlow, { defaultNodes: [task("a")], ...OPTIONS });
        expect(last().options).toMatchObject(OPTIONS);
    });

    it("send only the keys that changed: null is not undefined, a function is itself", async () => {
        const { rerender } = await render(TestFlow, {
            defaultNodes: [task("a")],
            nodeOrigin: { x: 0, y: 0 },
        });
        const { setOptions } = last();
        await rerender({ panOnScrollMode: "vertical" });
        expect(setOptions).toHaveBeenLastCalledWith({
            panOnScrollMode: "vertical",
        });
        await rerender({ panActivationKey: null });
        expect(setOptions).toHaveBeenLastCalledWith({ panActivationKey: null });
        await rerender({ easing: ease });
        expect(setOptions).toHaveBeenLastCalledWith({ easing: ease });
        await rerender({ easing: other });
        expect(setOptions).toHaveBeenLastCalledWith({ easing: other });
        const calls = setOptions.mock.calls.length;
        // an equal new object is the same
        await rerender({ nodeOrigin: { x: 0, y: 0 } });
        expect(setOptions).toHaveBeenCalledTimes(calls);
        await rerender({ panActivationKey: undefined });
        expect(setOptions).toHaveBeenLastCalledWith({
            panActivationKey: undefined,
        });
    });

    it("runs the controls' actions with their duration", async () => {
        const { container } = await render(DurationFlow, {
            defaultNodes: [task("a")],
        });
        const { run } = last();
        await click(byTestId(container, "in"));
        expect(run).toHaveBeenLastCalledWith("zoom-in", { duration: 300 });
        await click(byTestId(container, "out"));
        expect(run).toHaveBeenLastCalledWith("zoom-out", { duration: 200 });
        await click(byTestId(container, "fit"));
        expect(run).toHaveBeenLastCalledWith("fit-view", { duration: 400 });
        await click(byTestId(container, "plain"));
        expect(run).toHaveBeenLastCalledWith("zoom-in", {});
    });

    it("places a node by its origin (node-rect-by)", async () => {
        const { container, rerender } = await render(TestFlow, {
            defaultNodes: [task("a", 200, 100)],
            nodeOrigin: { x: 0.5, y: 0.5 },
        });
        expect(part(container, "node", "a").style.transform).toBe(
            "translate(150px, 80px)",
        );
        await rerender({ nodeOrigin: { x: 1, y: 0 } });
        expect(part(container, "node", "a").style.transform).toBe(
            "translate(100px, 100px)",
        );
    });

    it("gives each node its z-index from the core, raised when selected unless elevateNodesOnSelect is off", async () => {
        const { container, rerender } = await render(TestFlow, {
            features,
            defaultNodes: [
                task("a", 0, 0, { zIndex: 3 }),
                task("b", 0, 100, { selected: true }),
                task("c", 0, 200, { parentId: "a" }),
            ],
        });
        const z = (id: string) => part(container, "node", id).style.zIndex;
        expect(z("a")).toBe("3");
        expect(z("b")).toBe("10000");
        // a child above its parent
        expect(z("c")).toBe("4");
        await rerender({ elevateNodesOnSelect: false });
        expect(z("b")).toBe("0");
    });

    it("keeps the node's z-index when the consumer's style changes (its style string carries it)", async () => {
        const { container, rerender } = await render(ProbeFlow, {
            features,
            defaultNodes: [task("a", 0, 0, { zIndex: 2 })],
            nodeStyle: "color: red",
        });
        await rerender({ nodeStyle: "color: blue; z-index: 99" });
        const node = part(container, "node", "a");
        expect(node.style.color).toBe("blue");
        expect(node.style.zIndex).toBe("2");
    });

    it("draws the edges in the core's order (drawn-edges: by zIndex, a selected one raised with elevateEdgesOnSelect)", async () => {
        const { container, rerender } = await render(TestFlow, {
            features,
            defaultNodes: [task("a"), task("b", 0, 200), task("c", 200, 200)],
            defaultEdges: [
                { id: "e1", source: "a", target: "b", zIndex: 2 },
                { id: "e2", source: "a", target: "c", selected: true },
                { id: "e3", source: "b", target: "c", zIndex: 1 },
            ],
        });
        const order = () =>
            [...container.querySelectorAll('[data-flow-part="edge"]')].map(
                (edge) => edge.getAttribute("data-flow-id"),
            );
        expect(order()).toEqual(["e2", "e3", "e1"]);
        await rerender({ elevateEdgesOnSelect: true });
        expect(order()).toEqual(["e3", "e1", "e2"]);
    });

    it("keeps the nodes' z-index inside their layer (isolation), so a raised node never covers the connection line", async () => {
        const { container } = await render(TestFlow, {
            defaultNodes: [task("a")],
        });
        expect(part(container, "nodes").style.isolation).toBe("isolate");
    });

    it("re-exports the drag handle attribute", () => {
        expect(DRAG_HANDLE_ATTRIBUTE).toBe("data-flow-drag-handle");
    });
});
