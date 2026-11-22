// The engine options of #23 and #24 as root props, `duration` on the control buttons, and what the
// node and edges parts apply from the core (z-order, node origin). The engine is wrapped so the
// tests see what reaches it: its creation options, `adapter.setOptions` and `run`.
import type { FlowEngine, FlowEngineOptions, FlowModel } from "@fragiola/flow";
import { selection } from "@fragiola/flow/selection";
import { subflows } from "@fragiola/flow/subflows";
import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DRAG_HANDLE_ATTRIBUTE, Flow, type RootProps } from "../src/index";
import { drag, installLayout, part, settle, TestFlow, task } from "./flow";

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
} satisfies Partial<RootProps>;

const last = () => {
    const engine = engines.at(-1);
    if (!engine) throw new Error("no engine");
    return engine;
};

describe("the viewport and gesture options (#25)", () => {
    it("reach the engine it creates", async () => {
        render(<TestFlow defaultNodes={[task("a")]} {...OPTIONS} />);
        await settle();
        expect(last().options).toMatchObject(OPTIONS);
    });

    it("send only the keys that changed: null is not undefined, a function is itself", async () => {
        function App(props: Partial<RootProps>) {
            return (
                <TestFlow
                    defaultNodes={[task("a")]}
                    nodeOrigin={{ x: 0, y: 0 }}
                    {...props}
                />
            );
        }
        const { rerender } = render(<App />);
        await settle();
        const { setOptions } = last();
        rerender(<App panOnScrollMode="vertical" />);
        expect(setOptions).toHaveBeenLastCalledWith({
            panOnScrollMode: "vertical",
        });
        rerender(<App panOnScrollMode="vertical" panActivationKey={null} />);
        expect(setOptions).toHaveBeenLastCalledWith({ panActivationKey: null });
        rerender(
            <App
                panOnScrollMode="vertical"
                panActivationKey={null}
                easing={ease}
            />,
        );
        expect(setOptions).toHaveBeenLastCalledWith({ easing: ease });
        rerender(
            <App
                panOnScrollMode="vertical"
                panActivationKey={null}
                easing={other}
            />,
        );
        expect(setOptions).toHaveBeenLastCalledWith({ easing: other });
        const calls = setOptions.mock.calls.length;
        // an equal new object is the same
        rerender(
            <App
                panOnScrollMode="vertical"
                panActivationKey={null}
                easing={other}
                nodeOrigin={{ x: 0, y: 0 }}
            />,
        );
        expect(setOptions).toHaveBeenCalledTimes(calls);
        rerender(<App panOnScrollMode="vertical" easing={other} />);
        expect(setOptions).toHaveBeenLastCalledWith({
            panActivationKey: undefined,
        });
    });

    it("runs the controls' actions with their duration", async () => {
        const { getByTestId } = render(
            <TestFlow defaultNodes={[task("a")]}>
                <Flow.ZoomIn data-testid="in" duration={300} />
                <Flow.ZoomOut data-testid="out" duration={200} />
                <Flow.FitView data-testid="fit" duration={400} />
                <Flow.ZoomIn data-testid="plain" />
            </TestFlow>,
        );
        await settle();
        const { run } = last();
        fireEvent.click(getByTestId("in"));
        expect(run).toHaveBeenLastCalledWith("zoom-in", { duration: 300 });
        fireEvent.click(getByTestId("out"));
        expect(run).toHaveBeenLastCalledWith("zoom-out", { duration: 200 });
        fireEvent.click(getByTestId("fit"));
        expect(run).toHaveBeenLastCalledWith("fit-view", { duration: 400 });
        fireEvent.click(getByTestId("plain"));
        expect(run).toHaveBeenLastCalledWith("zoom-in", {});
    });

    it("places a node by its origin (node-rect-by), and at its position without an engine", async () => {
        const { container, rerender } = render(
            <TestFlow
                defaultNodes={[task("a", 200, 100)]}
                nodeOrigin={{ x: 0.5, y: 0.5 }}
            />,
        );
        await settle();
        expect(part(container, "node", "a").style.transform).toBe(
            "translate(150px, 80px)",
        );
        rerender(
            <TestFlow
                defaultNodes={[task("a", 200, 100)]}
                nodeOrigin={{ x: 1, y: 0 }}
            />,
        );
        expect(part(container, "node", "a").style.transform).toBe(
            "translate(100px, 100px)",
        );
    });

    it("gives each node its z-index from the core, raised when selected unless elevateNodesOnSelect is off", async () => {
        const nodes = [
            task("a", 0, 0, { zIndex: 3 }),
            task("b", 0, 100, { selected: true }),
            task("c", 0, 200, { parentId: "a" }),
        ];
        const { container, rerender } = render(
            <TestFlow features={features} defaultNodes={nodes} />,
        );
        await settle();
        const z = (id: string) => part(container, "node", id).style.zIndex;
        expect(z("a")).toBe("3");
        expect(z("b")).toBe("10000");
        // a child above its parent
        expect(z("c")).toBe("4");
        rerender(
            <TestFlow
                features={features}
                defaultNodes={nodes}
                elevateNodesOnSelect={false}
            />,
        );
        expect(z("b")).toBe("0");
    });

    it("draws the edges in the core's order (drawn-edges: by zIndex, a selected one raised with elevateEdgesOnSelect)", async () => {
        const nodes = [task("a"), task("b", 0, 200), task("c", 200, 200)];
        const edges = [
            { id: "e1", source: "a", target: "b", zIndex: 2 },
            { id: "e2", source: "a", target: "c", selected: true },
            { id: "e3", source: "b", target: "c", zIndex: 1 },
        ];
        const order = () =>
            [...container.querySelectorAll('[data-flow-part="edge"]')].map(
                (edge) => edge.getAttribute("data-flow-id"),
            );
        const { container, rerender } = render(
            <TestFlow
                features={features}
                defaultNodes={nodes}
                defaultEdges={edges}
            />,
        );
        await settle();
        expect(order()).toEqual(["e2", "e3", "e1"]);
        rerender(
            <TestFlow
                features={features}
                defaultNodes={nodes}
                defaultEdges={edges}
                elevateEdgesOnSelect
            />,
        );
        expect(order()).toEqual(["e3", "e1", "e2"]);
    });

    it("keeps the nodes' z-index inside their layer (isolation), so a raised node never covers the connection line", async () => {
        const { container } = render(<TestFlow defaultNodes={[task("a")]} />);
        await settle();
        expect(part(container, "nodes").style.isolation).toBe("isolate");
    });

    it("raises a node selected by a click, and lowers it when the pane's click clears the selection", async () => {
        const { container } = render(
            <TestFlow
                features={features}
                defaultNodes={[task("a"), task("b", 0, 200)]}
            />,
        );
        await settle();
        const z = (id: string) => part(container, "node", id).style.zIndex;
        expect(z("a")).toBe("0");
        const root = part(container, "root");
        drag(part(container, "node", "a"), root, [
            { clientX: 50, clientY: 20 },
        ]);
        expect(z("a")).toBe("10000");
        expect(z("b")).toBe("0");
        drag(part(container, "viewport"), root, [
            { clientX: 600, clientY: 500 },
        ]);
        expect(z("a")).toBe("0");
    });

    it("draws the edges in view with onlyRenderVisible: an edge panned out leaves, and comes back", async () => {
        const { container } = render(
            <TestFlow
                defaultNodes={[task("a"), task("b", 0, 200)]}
                defaultEdges={[{ id: "ab", source: "a", target: "b" }]}
                onlyRenderVisible
            />,
        );
        await settle();
        const edges = () =>
            container.querySelectorAll('[data-flow-part="edge"]').length;
        expect(edges()).toBe(1);
        const root = part(container, "root");
        const viewport = part(container, "viewport");
        drag(viewport, root, [
            { clientX: 700, clientY: 300 },
            { clientX: 700, clientY: -1500 },
        ]);
        await settle();
        expect(edges()).toBe(0);
        drag(viewport, root, [
            { clientX: 700, clientY: 300 },
            { clientX: 700, clientY: 2100 },
        ]);
        await settle();
        expect(edges()).toBe(1);
    });

    it("re-exports the drag handle attribute", () => {
        expect(DRAG_HANDLE_ATTRIBUTE).toBe("data-flow-drag-handle");
    });
});
