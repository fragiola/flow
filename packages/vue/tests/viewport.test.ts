import { beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, shallowRef } from "vue";
import {
    Flow,
    type FlowEdge,
    type FlowNode,
    type Viewport,
} from "../src/index";
import {
    click,
    drag,
    installLayout,
    pair,
    part,
    render,
    settle,
    TestFlow,
} from "./flow";

beforeEach(() => {
    installLayout();
});

async function wheel(target: Element, deltaY: number) {
    target.dispatchEvent(
        new WheelEvent("wheel", {
            bubbles: true,
            cancelable: true,
            deltaY,
            clientX: 400,
            clientY: 300,
        }),
    );
    await settle();
}

describe("the viewport", () => {
    it("starts at defaultViewport, written by the engine, never by Vue", async () => {
        const { container } = await render(() =>
            h(TestFlow, {
                defaultNodes: pair().nodes,
                defaultViewport: { x: 10, y: 20, zoom: 1.5 },
            }),
        );
        const viewport = part(container, "viewport");
        expect(viewport.style.transform).toBe(
            "translate(10px, 20px) scale(1.5)",
        );
        expect(viewport.style.transformOrigin).toBe("0 0");
        // its own stacking context, transform or not: the render levels' negative z-indexes
        expect(viewport.style.isolation).toBe("isolate");
    });

    it("pans by a drag on the pane and zooms by the wheel without re-rendering the nodes or the edges", async () => {
        const renders = vi.fn();
        const changes = vi.fn();
        const Counted = defineComponent({
            props: { id: { type: String, required: true } },
            setup(props) {
                return () => {
                    renders(props.id);
                    return null;
                };
            },
        });
        const { container } = await render(() =>
            h(
                Flow.Root,
                {
                    defaultNodes: pair().nodes,
                    defaultEdges: pair().edges,
                    "onUpdate:viewport": changes,
                },
                () => [
                    h(Flow.Viewport, null, () => [
                        h(Flow.Edges, null, {
                            default: ({ edge }: { edge: FlowEdge }) => [
                                h(Flow.Edge, { edge }, () => [
                                    h(Flow.EdgePath),
                                    h(Counted, { id: edge.id }),
                                ]),
                            ],
                        }),
                        h(Flow.Nodes, null, {
                            default: ({ node }: { node: FlowNode }) => [
                                h(Flow.Node, { node }, () => [
                                    h(Counted, { id: node.id }),
                                ]),
                            ],
                        }),
                    ]),
                ],
            ),
        );
        expect(renders).toHaveBeenCalledWith("ab");
        renders.mockClear();
        const viewport = part(container, "viewport");
        await drag(viewport, part(container, "root"), [
            { clientX: 400, clientY: 300 },
            { clientX: 450, clientY: 330 },
        ]);
        expect(viewport.style.transform).toBe("translate(50px, 30px) scale(1)");
        await wheel(viewport, -120);
        expect(viewport.style.transform).toMatch(/scale\(1\.2/);
        expect(changes).toHaveBeenCalled();
        expect(changes.mock.calls.at(-1)?.[1]).toBe(true);
        expect(renders).not.toHaveBeenCalled();
    });

    it("follows a controlled viewport (v-model:viewport), and tells every change", async () => {
        const viewport = shallowRef<Viewport>({ x: 0, y: 0, zoom: 1 });
        const changes: Viewport[] = [];
        const { container } = await render(() =>
            h(
                TestFlow,
                {
                    viewport: viewport.value,
                    "onUpdate:viewport": (next: Viewport) => {
                        changes.push(next);
                        viewport.value = next;
                    },
                },
                () => [h(Flow.ZoomOut, { "data-testid": "out" })],
            ),
        );
        viewport.value = { x: 100, y: 50, zoom: 2 };
        await settle();
        expect(part(container, "viewport").style.transform).toBe(
            "translate(100px, 50px) scale(2)",
        );
        await click(
            container.querySelector('[data-testid="out"]') as HTMLElement,
        );
        expect(changes.at(-1)?.zoom).toBeCloseTo(2 / 1.2);
        expect(viewport.value.zoom).toBeCloseTo(2 / 1.2);
        expect(part(container, "viewport").style.transform).toMatch(
            /scale\(1\.66/,
        );
    });

    it("fits the nodes with fitView once they are measured, and with Flow.FitView", async () => {
        const { container } = await render(() =>
            h(TestFlow, { defaultNodes: pair().nodes, fitView: true }, () => [
                h(Flow.FitView, { "data-testid": "fit" }),
            ]),
        );
        const fitted = part(container, "viewport").style.transform;
        expect(fitted).not.toBe("translate(0px, 0px) scale(1)");
        const fit = container.querySelector(
            '[data-testid="fit"]',
        ) as HTMLElement;
        expect(fit).not.toBeDisabled();
        await click(fit);
        expect(part(container, "viewport").style.transform).toBe(fitted);
    });

    it("takes a bare fit-view attribute as true", async () => {
        const { container } = await render(() =>
            h(TestFlow, { defaultNodes: pair().nodes, "fit-view": "" }),
        );
        expect(part(container, "viewport").style.transform).not.toBe(
            "translate(0px, 0px) scale(1)",
        );
    });

    it("applies engine props that change (the zoom limits) at once", async () => {
        const maxZoom = shallowRef(2);
        const { container } = await render(() =>
            h(
                TestFlow,
                {
                    maxZoom: maxZoom.value,
                    defaultViewport: { x: 0, y: 0, zoom: 2 },
                },
                () => [h(Flow.ZoomIn, { "data-testid": "in" })],
            ),
        );
        const zoomIn = () =>
            container.querySelector('[data-testid="in"]') as HTMLElement;
        expect(zoomIn()).toBeDisabled();
        maxZoom.value = 4;
        await settle();
        expect(zoomIn()).not.toBeDisabled();
        maxZoom.value = 1;
        await settle();
        expect(part(container, "viewport").style.transform).toMatch(
            /scale\(1\)/,
        );
    });

    it("sends only the engine props that changed: a lock by Flow.ToggleInteractive stays", async () => {
        const minZoom = shallowRef(0.5);
        const { container } = await render(() =>
            h(TestFlow, { interactive: true, minZoom: minZoom.value }, () => [
                h(Flow.ToggleInteractive, { "data-testid": "lock" }),
            ]),
        );
        // an `interactive` that stays never undoes the lock (#33: the lock's switches)
        const lock = container.querySelector(
            '[data-testid="lock"]',
        ) as HTMLElement;
        await click(lock);
        expect(lock).toHaveAttribute("aria-pressed", "true");
        minZoom.value = 0.25;
        await settle();
        expect(lock).toHaveAttribute("aria-pressed", "true");
        expect(part(container, "root")).toHaveAttribute("data-interactive");
    });

    it("draws the background pattern at the viewport", async () => {
        const { container } = await render(() =>
            h(Flow.Root, { defaultViewport: { x: 5, y: 0, zoom: 2 } }, () => [
                h(Flow.Background, { variant: "lines", gap: 10 }),
                h(Flow.Viewport),
            ]),
        );
        const pattern = part(container, "background-pattern");
        expect(pattern.getAttribute("width")).toBe("20");
        expect(part(container, "background-mark").tagName.toLowerCase()).toBe(
            "path",
        );
        expect(
            part(container, "background-mark").getAttribute("stroke-width"),
        ).not.toBeNull();
        const fill = part(container, "background-fill");
        expect(fill.getAttribute("fill")).toBe(`url(#${pattern.id})`);
    });
});
