import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    createFlowRef,
    type Viewport,
    type ViewportMoveEvent,
} from "../src/public-api";
import { BackgroundFlow, ProbeFlow, TestFlow } from "./fixtures";
import { click, drag, installLayout, pair, part, render, wheel } from "./flow";

beforeEach(() => {
    installLayout();
});

const byTestId = (container: HTMLElement, id: string) =>
    container.querySelector(`[data-testid="${id}"]`) as HTMLElement;

describe("the viewport", () => {
    it("starts at defaultViewport, written by the engine, never by Angular", async () => {
        const { container } = await render(TestFlow, {
            defaultNodes: pair().nodes,
            defaultViewport: { x: 10, y: 20, zoom: 1.5 },
        });
        const viewport = part(container, "viewport");
        expect(viewport.style.transform).toBe(
            "translate(10px, 20px) scale(1.5)",
        );
        expect(viewport.style.transformOrigin).toBe("0 0");
    });

    it("pans by a drag on the pane and zooms by the wheel without rendering the nodes or the edges again", async () => {
        const renders = vi.fn();
        const moves: boolean[] = [];
        const flow = createFlowRef();
        const { container } = await render(ProbeFlow, {
            defaultNodes: pair().nodes,
            defaultEdges: pair().edges,
            flowRef: flow,
            onRender: (kind: string) => renders(kind),
        });
        flow.current?.engine.subscribe((event) => {
            if (event.type === "viewport-change") moves.push(event.gesture);
        });
        expect(renders).toHaveBeenCalledWith("edge");
        renders.mockClear();
        const viewport = part(container, "viewport");
        await drag(viewport, part(container, "root"), [
            { clientX: 400, clientY: 300 },
            { clientX: 450, clientY: 330 },
        ]);
        expect(viewport.style.transform).toBe("translate(50px, 30px) scale(1)");
        await wheel(viewport, -120);
        expect(viewport.style.transform).toMatch(/scale\(1\.2/);
        expect(moves.at(-1)).toBe(true);
        expect(renders).not.toHaveBeenCalled();
    });

    it("keeps the engine's transform and touch-action when the app's style changes", async () => {
        const { container, set } = await render(ProbeFlow, {
            defaultNodes: pair().nodes,
            defaultViewport: { x: 10, y: 20, zoom: 1.5 },
            style: "color: red",
            viewportStyle: "color: red",
        });
        await set({ style: "color: blue", viewportStyle: "color: blue" });
        const root = part(container, "root");
        expect(root.style.color).toBe("blue");
        expect(root.style.touchAction).toBe("none");
        const viewport = part(container, "viewport");
        expect(viewport.style.color).toBe("blue");
        expect(viewport.style.transform).toBe(
            "translate(10px, 20px) scale(1.5)",
        );
    });

    it("follows a controlled viewport, and tells every change (viewportChange)", async () => {
        const changes: Viewport[] = [];
        const { container, set } = await render(TestFlow, {
            controls: true,
            viewport: { x: 0, y: 0, zoom: 1 },
            onViewportChange: (next: Viewport) => changes.push(next),
        });
        await set({ viewport: { x: 100, y: 50, zoom: 2 } });
        expect(part(container, "viewport").style.transform).toBe(
            "translate(100px, 50px) scale(2)",
        );
        await click(byTestId(container, "out"));
        expect(changes.at(-1)?.zoom).toBeCloseTo(2 / 1.2);
        expect(part(container, "viewport").style.transform).toMatch(
            /scale\(1\.66/,
        );
    });

    it("tells every viewport change with what made it (viewportMove)", async () => {
        const moves: ViewportMoveEvent[] = [];
        const { container } = await render(TestFlow, {
            controls: true,
            onViewportMove: (event: ViewportMoveEvent) => moves.push(event),
        });
        await drag(part(container, "viewport"), part(container, "root"), [
            { clientX: 400, clientY: 300 },
            { clientX: 420, clientY: 300 },
        ]);
        expect(moves.at(-1)).toEqual({
            viewport: { x: 20, y: 0, zoom: 1 },
            gesture: true,
        });
        await click(byTestId(container, "in"));
        expect(moves.at(-1)?.gesture).toBe(false);
    });

    it("updates a template that shows an engine value (injectViewport) as the view changes", async () => {
        const { container } = await render(TestFlow, { controls: true });
        const zoom = byTestId(container, "zoom");
        expect(zoom).toHaveTextContent("1");
        await wheel(part(container, "viewport"), -120);
        expect(Number(zoom.textContent)).toBeCloseTo(Math.exp(120 / 600));
        await click(byTestId(container, "out"));
        expect(Number(zoom.textContent)).toBeCloseTo(Math.exp(120 / 600) / 1.2);
    });

    it("fits the nodes with fitView once they are measured, and with [flowFitView]", async () => {
        const { container } = await render(TestFlow, {
            controls: true,
            defaultNodes: pair().nodes,
            fitView: true,
        });
        const fitted = part(container, "viewport").style.transform;
        expect(fitted).not.toBe("translate(0px, 0px) scale(1)");
        const fit = byTestId(container, "fit");
        expect(fit).not.toBeDisabled();
        await click(fit);
        expect(part(container, "viewport").style.transform).toBe(fitted);
    });

    it("applies engine inputs that change (the zoom limits) at once", async () => {
        const { container, set } = await render(TestFlow, {
            controls: true,
            maxZoom: 2,
            defaultViewport: { x: 0, y: 0, zoom: 2 },
        });
        expect(byTestId(container, "in")).toBeDisabled();
        await set({ maxZoom: 4 });
        expect(byTestId(container, "in")).not.toBeDisabled();
        await set({ maxZoom: 1 });
        expect(part(container, "viewport").style.transform).toMatch(
            /scale\(1\)/,
        );
    });

    it("sends only the engine inputs that changed: a lock by [flowToggleInteractive] stays", async () => {
        const { container, set } = await render(TestFlow, {
            controls: true,
            interactive: true,
            minZoom: 0.5,
        });
        await click(byTestId(container, "lock"));
        expect(part(container, "root")).not.toHaveAttribute("data-interactive");
        await set({ minZoom: 0.25 });
        expect(part(container, "root")).not.toHaveAttribute("data-interactive");
    });

    it("draws the background pattern at the viewport", async () => {
        const { container } = await render(BackgroundFlow, {
            defaultViewport: { x: 5, y: 0, zoom: 2 },
        });
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
