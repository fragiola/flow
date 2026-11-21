import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Viewport } from "../src/index";
import BackgroundFlow from "./fixtures/background-flow.svelte";
import ControlsFlow from "./fixtures/controls-flow.svelte";
import ProbeFlow from "./fixtures/probe-flow.svelte";
import TestFlow from "./fixtures/test-flow.svelte";
import { click, drag, installLayout, pair, part, render, settle } from "./flow";

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

const byTestId = (container: HTMLElement, id: string) =>
    container.querySelector(`[data-testid="${id}"]`) as HTMLElement;

describe("the viewport", () => {
    it("starts at defaultViewport, written by the engine, never by Svelte", async () => {
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
        const changes = vi.fn();
        const { container } = await render(ProbeFlow, {
            defaultNodes: pair().nodes,
            defaultEdges: pair().edges,
            onrender: (kind: string) => renders(kind),
            onviewportchange: changes,
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
        expect(changes).toHaveBeenCalled();
        expect(changes.mock.calls.at(-1)?.[1]).toBe(true);
        expect(renders).not.toHaveBeenCalled();
    });

    it("keeps the engine's transform when the consumer's style changes", async () => {
        const { container, rerender } = await render(ProbeFlow, {
            defaultNodes: pair().nodes,
            defaultViewport: { x: 10, y: 20, zoom: 1.5 },
            style: "color: red",
            viewportStyle: "color: red",
        });
        await rerender({ style: "color: blue", viewportStyle: "color: blue" });
        const root = part(container, "root");
        expect(root.style.color).toBe("blue");
        expect(root.style.touchAction).toBe("none");
        const viewport = part(container, "viewport");
        expect(viewport.style.color).toBe("blue");
        expect(viewport.style.transform).toBe(
            "translate(10px, 20px) scale(1.5)",
        );
    });

    it("follows a controlled viewport (bind:viewport), and tells every change", async () => {
        const changes: Viewport[] = [];
        const { container, rerender } = await render(ControlsFlow, {
            viewport: { x: 0, y: 0, zoom: 1 },
            onviewportchange: (next: Viewport) => changes.push(next),
        });
        await rerender({ viewport: { x: 100, y: 50, zoom: 2 } });
        expect(part(container, "viewport").style.transform).toBe(
            "translate(100px, 50px) scale(2)",
        );
        await click(byTestId(container, "out"));
        expect(changes.at(-1)?.zoom).toBeCloseTo(2 / 1.2);
        expect(part(container, "viewport").style.transform).toMatch(
            /scale\(1\.66/,
        );
    });

    it("fits the nodes with fitView once they are measured, and with Flow.FitView", async () => {
        const { container } = await render(ControlsFlow, {
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

    it("applies engine props that change (the zoom limits) at once", async () => {
        const { container, rerender } = await render(ControlsFlow, {
            maxZoom: 2,
            defaultViewport: { x: 0, y: 0, zoom: 2 },
        });
        expect(byTestId(container, "in")).toBeDisabled();
        await rerender({ maxZoom: 4 });
        expect(byTestId(container, "in")).not.toBeDisabled();
        await rerender({ maxZoom: 1 });
        expect(part(container, "viewport").style.transform).toMatch(
            /scale\(1\)/,
        );
    });

    it("sends only the engine props that changed: a lock by Flow.ToggleInteractive stays", async () => {
        const { container, rerender } = await render(ControlsFlow, {
            interactive: true,
            minZoom: 0.5,
        });
        await click(byTestId(container, "lock"));
        expect(part(container, "root")).not.toHaveAttribute("data-interactive");
        await rerender({ minZoom: 0.25 });
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
