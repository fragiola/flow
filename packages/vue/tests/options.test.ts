// The engine options of #23 and #24 as root props, `duration` on the control buttons, and what the
// node and edges parts apply from the core (z-order, node origin): React's
// `tests/options.test.tsx`. The engine is wrapped so the tests see what reaches it: its creation
// options, `adapter.setOptions` and `run`.
import type { FlowEngine, FlowEngineOptions, FlowModel } from "@fragiola/flow";
import { selection } from "@fragiola/flow/selection";
import { subflows } from "@fragiola/flow/subflows";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { h, shallowRef } from "vue";
import { DRAG_HANDLE_ATTRIBUTE, Flow } from "../src/index";
import {
    click,
    drag,
    installLayout,
    part,
    render,
    settle,
    TestFlow,
    task,
} from "./flow";

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

describe("the viewport and gesture options (#25)", () => {
    it("reach the engine it creates", async () => {
        await render(() =>
            h(TestFlow, { defaultNodes: [task("a")], ...OPTIONS }),
        );
        expect(last().options).toMatchObject(OPTIONS);
    });

    it("take bare attributes as true, and mouse buttons as a list", async () => {
        await render(() =>
            h(TestFlow, {
                defaultNodes: [task("a")],
                autoPan: "",
                elevateEdgesOnSelect: "",
                panOnDrag: [1],
            }),
        );
        expect(last().options).toMatchObject({
            autoPan: true,
            elevateEdgesOnSelect: true,
            panOnDrag: [1],
        });
        expect(last().options.elevateNodesOnSelect).toBeUndefined();
    });

    it("send only the keys that changed: null is not undefined, a function is itself", async () => {
        const props = shallowRef<Record<string, unknown>>({});
        await render(() =>
            h(TestFlow, {
                defaultNodes: [task("a")],
                nodeOrigin: { x: 0, y: 0 },
                ...props.value,
            }),
        );
        const { setOptions } = last();
        const set = async (next: Record<string, unknown>) => {
            props.value = next;
            await settle();
        };
        await set({ panOnScrollMode: "vertical" });
        expect(setOptions).toHaveBeenLastCalledWith({
            panOnScrollMode: "vertical",
        });
        await set({ panOnScrollMode: "vertical", panActivationKey: null });
        expect(setOptions).toHaveBeenLastCalledWith({ panActivationKey: null });
        await set({
            panOnScrollMode: "vertical",
            panActivationKey: null,
            easing: ease,
        });
        expect(setOptions).toHaveBeenLastCalledWith({ easing: ease });
        await set({
            panOnScrollMode: "vertical",
            panActivationKey: null,
            easing: other,
        });
        expect(setOptions).toHaveBeenLastCalledWith({ easing: other });
        const calls = setOptions.mock.calls.length;
        // an equal new object is the same
        await set({
            panOnScrollMode: "vertical",
            panActivationKey: null,
            easing: other,
            nodeOrigin: { x: 0, y: 0 },
        });
        expect(setOptions).toHaveBeenCalledTimes(calls);
        await set({ panOnScrollMode: "vertical", easing: other });
        expect(setOptions).toHaveBeenLastCalledWith({
            panActivationKey: undefined,
        });
    });

    it("runs the controls' actions with their duration", async () => {
        const { container } = await render(() =>
            h(TestFlow, { defaultNodes: [task("a")] }, () => [
                h(Flow.ZoomIn, { "data-testid": "in", duration: 300 }),
                h(Flow.ZoomOut, { "data-testid": "out", duration: 200 }),
                h(Flow.FitView, { "data-testid": "fit", duration: 400 }),
                h(Flow.ZoomIn, { "data-testid": "plain" }),
            ]),
        );
        const button = (id: string) =>
            container.querySelector(`[data-testid="${id}"]`) as HTMLElement;
        const { run } = last();
        await click(button("in"));
        expect(run).toHaveBeenLastCalledWith("zoom-in", { duration: 300 });
        await click(button("out"));
        expect(run).toHaveBeenLastCalledWith("zoom-out", { duration: 200 });
        await click(button("fit"));
        expect(run).toHaveBeenLastCalledWith("fit-view", { duration: 400 });
        await click(button("plain"));
        expect(run).toHaveBeenLastCalledWith("zoom-in", {});
    });

    it("places a node by its origin (node-rect-by)", async () => {
        const origin = shallowRef({ x: 0.5, y: 0.5 });
        const { container } = await render(() =>
            h(TestFlow, {
                defaultNodes: [task("a", 200, 100)],
                nodeOrigin: origin.value,
            }),
        );
        expect(part(container, "node", "a").style.transform).toBe(
            "translate(150px, 80px)",
        );
        origin.value = { x: 1, y: 0 };
        await settle();
        expect(part(container, "node", "a").style.transform).toBe(
            "translate(100px, 100px)",
        );
    });

    it("gives each node its z-index from the core, raised when selected unless elevateNodesOnSelect is off", async () => {
        const elevate = shallowRef<boolean | undefined>(undefined);
        const nodes = [
            task("a", 0, 0, { zIndex: 3 }),
            task("b", 0, 100, { selected: true }),
            task("c", 0, 200, { parentId: "a" }),
        ];
        const { container } = await render(() =>
            h(TestFlow, {
                features,
                defaultNodes: nodes,
                elevateNodesOnSelect: elevate.value,
            }),
        );
        const z = (id: string) => part(container, "node", id).style.zIndex;
        expect(z("a")).toBe("3");
        expect(z("b")).toBe("10000");
        // a child above its parent
        expect(z("c")).toBe("4");
        elevate.value = false;
        await settle();
        expect(z("b")).toBe("0");
    });

    it("draws the edges in the core's order (drawn-edges: by zIndex, a selected one raised with elevateEdgesOnSelect, in the basic zIndexMode)", async () => {
        const elevate = shallowRef<boolean | undefined>(undefined);
        const nodes = [task("a"), task("b", 0, 200), task("c", 200, 200)];
        const edges = [
            { id: "e1", source: "a", target: "b", zIndex: 2 },
            { id: "e2", source: "a", target: "c", selected: true },
            { id: "e3", source: "b", target: "c", zIndex: 1 },
        ];
        const { container } = await render(() =>
            h(TestFlow, {
                features,
                defaultNodes: nodes,
                defaultEdges: edges,
                zIndexMode: "basic",
                elevateEdgesOnSelect: elevate.value,
            }),
        );
        const order = () =>
            [...container.querySelectorAll('[data-flow-part="edge"]')].map(
                (edge) => edge.getAttribute("data-flow-id"),
            );
        expect(order()).toEqual(["e2", "e3", "e1"]);
        elevate.value = true;
        await settle();
        expect(order()).toEqual(["e3", "e1", "e2"]);
        expect(
            container.querySelector('[data-flow-part="edges-layer"]'),
        ).toBeNull();
    });

    it("raises a selected edge above the nodes in the default auto zIndexMode (its own render level)", async () => {
        const nodes = [task("a"), task("b", 0, 200), task("c", 200, 200)];
        const edges = [
            { id: "e1", source: "a", target: "b" },
            { id: "e2", source: "a", target: "c", selected: true },
            { id: "e3", source: "b", target: "c" },
        ];
        const { container } = await render(() =>
            h(TestFlow, {
                features,
                defaultNodes: nodes,
                defaultEdges: edges,
            }),
        );
        const layers = [
            ...container.querySelectorAll<HTMLElement>(
                '[data-flow-part="edges-layer"]',
            ),
        ];
        const idsIn = (element: Element) =>
            [...element.querySelectorAll('[data-flow-part="edge"]')].map(
                (edge) => edge.getAttribute("data-flow-id"),
            );
        expect(layers.map((layer) => layer.dataset.level)).toEqual(["0", "1"]);
        expect(layers.map(idsIn)).toEqual([["e1", "e3"], ["e2"]]);
        // the upper level stands above the nodes, both below what follows the layers
        const [lower, upper] = layers.map((layer) =>
            Number(layer.style.zIndex),
        );
        const node = Number(part(container, "node", "a").style.zIndex);
        expect(lower).toBeLessThan(node);
        expect(upper).toBeGreaterThan(node);
        expect(upper).toBeLessThan(0);
        expect(part(container, "nodes").style.isolation).toBe("");
    });

    it("forwards zIndexMode to the engine, and a change to setOptions", async () => {
        const mode = shallowRef<"basic" | "auto" | "manual">("basic");
        await render(() =>
            h(TestFlow, { defaultNodes: [task("a")], zIndexMode: mode.value }),
        );
        expect(last().options.zIndexMode).toBe("basic");
        mode.value = "manual";
        await settle();
        expect(last().setOptions).toHaveBeenLastCalledWith({
            zIndexMode: "manual",
        });
    });

    it("takes a number's text for duration and pan-on-scroll-speed", async () => {
        const { container } = await render(() =>
            h(
                TestFlow,
                { defaultNodes: [task("a")], panOnScrollSpeed: "2" },
                () => [
                    h(Flow.ZoomIn, { "data-testid": "in", duration: "300" }),
                ],
            ),
        );
        expect(last().options.panOnScrollSpeed).toBe(2);
        const button = container.querySelector(
            '[data-testid="in"]',
        ) as HTMLElement;
        expect(button).not.toBeDisabled();
        await click(button);
        expect(last().run).toHaveBeenLastCalledWith("zoom-in", {
            duration: 300,
        });
    });

    it("keeps the nodes' z-index inside their layer (isolation), so a raised node never covers the connection line", async () => {
        const { container } = await render(() =>
            h(TestFlow, { defaultNodes: [task("a")] }),
        );
        expect(part(container, "nodes").style.isolation).toBe("isolate");
    });

    it("raises a node selected by a click, and lowers it when the pane's click clears the selection", async () => {
        const { container } = await render(() =>
            h(TestFlow, {
                features,
                defaultNodes: [task("a"), task("b", 0, 200)],
            }),
        );
        const z = (id: string) => part(container, "node", id).style.zIndex;
        expect(z("a")).toBe("0");
        const root = part(container, "root");
        await drag(part(container, "node", "a"), root, [
            { clientX: 50, clientY: 20 },
        ]);
        expect(z("a")).toBe("10000");
        expect(z("b")).toBe("0");
        await drag(part(container, "viewport"), root, [
            { clientX: 600, clientY: 500 },
        ]);
        expect(z("a")).toBe("0");
    });

    it("draws the edges in view with onlyRenderVisible: an edge panned out leaves, and comes back", async () => {
        const { container } = await render(() =>
            h(TestFlow, {
                defaultNodes: [task("a"), task("b", 0, 200)],
                defaultEdges: [{ id: "ab", source: "a", target: "b" }],
                onlyRenderVisible: true,
            }),
        );
        const edges = () =>
            container.querySelectorAll('[data-flow-part="edge"]').length;
        expect(edges()).toBe(1);
        const root = part(container, "root");
        const viewport = part(container, "viewport");
        await drag(viewport, root, [
            { clientX: 700, clientY: 300 },
            { clientX: 700, clientY: -1500 },
        ]);
        expect(edges()).toBe(0);
        await drag(viewport, root, [
            { clientX: 700, clientY: 300 },
            { clientX: 700, clientY: 2100 },
        ]);
        expect(edges()).toBe(1);
    });

    it("re-exports the drag handle attribute", () => {
        expect(DRAG_HANDLE_ATTRIBUTE).toBe("data-flow-drag-handle");
    });
});
