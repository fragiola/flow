// The engine options of #23 and #24 as root inputs, `duration` on the control buttons, and what
// the node and edges parts apply from the core (z-order, node origin): React's
// `tests/options.test.tsx`. The engine is wrapped so the tests see what reaches it: its creation
// options, `adapter.setOptions` and `run`.
import { Component, input } from "@angular/core";
import type { FlowEngine, FlowEngineOptions, FlowModel } from "@fragiola/flow";
import { selection } from "@fragiola/flow/selection";
import { subflows } from "@fragiola/flow/subflows";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DRAG_HANDLE_ATTRIBUTE, FLOW, type FlowNode } from "../src/public-api";
import { ProbeFlow, TestFlow } from "./fixtures";
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

/** The options of #33 as attribute text, and the tap distances bound. */
@Component({
    selector: "test-interaction-options",
    imports: [FLOW],
    template: `
        @if (bound()) {
            <div
                flowRoot
                [defaultNodes]="nodes"
                [paneClickDistance]="pane()"
                [nodeClickDistance]="node()"
                [nodesFocusable]="nodesFocusable()"
            ></div>
        } @else {
            <div
                flowRoot
                [defaultNodes]="nodes"
                paneClickDistance="30"
                nodeClickDistance="5"
                preventScrolling
                nodesFocusable="false"
                edgesFocusable
            ></div>
        }
    `,
})
class InteractionOptions {
    readonly bound = input(false);
    readonly pane = input<number | undefined>();
    readonly node = input<number | undefined>();
    readonly nodesFocusable = input<boolean | undefined>();
    readonly nodes: FlowNode[] = [task("a")];
}

const byTestId = (container: HTMLElement, id: string) =>
    container.querySelector(`[data-testid="${id}"]`) as HTMLElement;

describe("the viewport and gesture options (#25)", () => {
    it("reach the engine it creates", async () => {
        await render(TestFlow, { defaultNodes: [task("a")], ...OPTIONS });
        expect(last().options).toMatchObject(OPTIONS);
    });

    it("send only the keys that changed: null is not undefined, a function is itself", async () => {
        const { set } = await render(TestFlow, {
            defaultNodes: [task("a")],
            nodeOrigin: { x: 0, y: 0 },
        });
        const { setOptions } = last();
        await set({ panOnScrollMode: "vertical" });
        expect(setOptions).toHaveBeenLastCalledWith({
            panOnScrollMode: "vertical",
        });
        await set({ panActivationKey: null });
        expect(setOptions).toHaveBeenLastCalledWith({ panActivationKey: null });
        await set({ easing: ease });
        expect(setOptions).toHaveBeenLastCalledWith({ easing: ease });
        await set({ easing: other });
        expect(setOptions).toHaveBeenLastCalledWith({ easing: other });
        const calls = setOptions.mock.calls.length;
        // an equal new object is the same
        await set({ nodeOrigin: { x: 0, y: 0 } });
        expect(setOptions).toHaveBeenCalledTimes(calls);
        await set({ panActivationKey: undefined });
        expect(setOptions).toHaveBeenLastCalledWith({
            panActivationKey: undefined,
        });
    });

    it("runs the controls' actions with their duration (an attribute's text as a number)", async () => {
        const { container } = await render(TestFlow, {
            defaultNodes: [task("a")],
            controls: true,
            durations: true,
        });
        const { run } = last();
        await click(byTestId(container, "in-300"));
        expect(run).toHaveBeenLastCalledWith("zoom-in", { duration: 300 });
        await click(byTestId(container, "out-200"));
        expect(run).toHaveBeenLastCalledWith("zoom-out", { duration: 200 });
        await click(byTestId(container, "fit-400"));
        expect(run).toHaveBeenLastCalledWith("fit-view", { duration: 400 });
        await click(byTestId(container, "in"));
        expect(run).toHaveBeenLastCalledWith("zoom-in", {});
    });

    it("places a node by its origin (node-rect-by)", async () => {
        const { container, set } = await render(TestFlow, {
            defaultNodes: [task("a", 200, 100)],
            nodeOrigin: { x: 0.5, y: 0.5 },
        });
        expect(part(container, "node", "a").style.transform).toBe(
            "translate(150px, 80px)",
        );
        await set({ nodeOrigin: { x: 1, y: 0 } });
        expect(part(container, "node", "a").style.transform).toBe(
            "translate(100px, 100px)",
        );
    });

    it("gives each node its z-index from the core, raised when selected unless elevateNodesOnSelect is off", async () => {
        const { container, set } = await render(TestFlow, {
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
        await set({ elevateNodesOnSelect: false });
        expect(z("b")).toBe("0");
    });

    it("keeps the node's z-index over the app's style binding (bindStructuralStyle)", async () => {
        const { container, set } = await render(ProbeFlow, {
            features,
            defaultNodes: [task("a", 0, 0, { zIndex: 2 })],
            nodeStyle: "color: red",
        });
        await set({ nodeStyle: "color: blue; z-index: 99" });
        const node = part(container, "node", "a");
        expect(node.style.color).toBe("blue");
        expect(node.style.zIndex).toBe("2");
    });

    it("draws the edges in the core's order (drawn-edges: by zIndex, a selected one raised with elevateEdgesOnSelect)", async () => {
        const { container, set } = await render(TestFlow, {
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
        await set({ elevateEdgesOnSelect: true });
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

describe("the interaction options (#33)", () => {
    it("take their attributes' text: numbers, and bare or false booleans", async () => {
        await render(InteractionOptions);
        expect(last().options).toMatchObject({
            paneClickDistance: 30,
            nodeClickDistance: 5,
            preventScrolling: true,
            nodesFocusable: false,
            edgesFocusable: true,
        });
    });

    it("send the ones that change, absent ones undefined", async () => {
        const { set } = await render(InteractionOptions, { bound: true });
        expect(last().options.paneClickDistance).toBeUndefined();
        expect(last().options.preventScrolling).toBeUndefined();
        const { setOptions } = last();
        await set({ pane: 12 });
        expect(setOptions).toHaveBeenLastCalledWith({ paneClickDistance: 12 });
        await set({ node: 3 });
        expect(setOptions).toHaveBeenLastCalledWith({ nodeClickDistance: 3 });
        await set({ nodesFocusable: false });
        expect(setOptions).toHaveBeenLastCalledWith({ nodesFocusable: false });
    });
});
