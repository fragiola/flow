import { act, fireEvent, render } from "@testing-library/react";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Flow, type Viewport } from "../src/index";
import { drag, installLayout, pair, part, settle, TestFlow } from "./flow";

beforeEach(() => {
    installLayout();
});

function wheel(target: Element, deltaY: number) {
    act(() => {
        target.dispatchEvent(
            new WheelEvent("wheel", {
                bubbles: true,
                cancelable: true,
                deltaY,
                clientX: 400,
                clientY: 300,
            }),
        );
    });
}

describe("the viewport", () => {
    it("starts at defaultViewport, written by the engine, never by React", async () => {
        const { container } = render(
            <TestFlow
                defaultNodes={pair().nodes}
                defaultViewport={{ x: 10, y: 20, zoom: 1.5 }}
            />,
        );
        await settle();
        const viewport = part(container, "viewport");
        expect(viewport.style.transform).toBe(
            "translate(10px, 20px) scale(1.5)",
        );
        expect(viewport.style.transformOrigin).toBe("0 0");
    });

    it("pans by a drag on the pane and zooms by the wheel without re-rendering the nodes or the edges", async () => {
        const renders = vi.fn();
        const onViewportChange = vi.fn();
        function Counted({ id }: { id: string }) {
            renders(id);
            return null;
        }
        const { container } = render(
            <Flow.Root
                defaultNodes={pair().nodes}
                defaultEdges={pair().edges}
                onViewportChange={onViewportChange}
            >
                <Flow.Viewport>
                    <Flow.Edges>
                        {(edge) => (
                            <Flow.Edge
                                edge={edge}
                                className={() => {
                                    renders(edge.id);
                                    return undefined;
                                }}
                            />
                        )}
                    </Flow.Edges>
                    <Flow.Nodes>
                        {(node) => (
                            <Flow.Node node={node}>
                                <Counted id={node.id} />
                            </Flow.Node>
                        )}
                    </Flow.Nodes>
                </Flow.Viewport>
            </Flow.Root>,
        );
        await settle();
        expect(renders).toHaveBeenCalledWith("ab");
        renders.mockClear();
        const viewport = part(container, "viewport");
        drag(viewport, part(container, "root"), [
            { clientX: 400, clientY: 300 },
            { clientX: 450, clientY: 330 },
        ]);
        expect(viewport.style.transform).toBe("translate(50px, 30px) scale(1)");
        wheel(viewport, -120);
        expect(viewport.style.transform).toMatch(/scale\(1\.2/);
        expect(onViewportChange).toHaveBeenCalled();
        expect(onViewportChange.mock.calls.at(-1)?.[1]).toBe(true);
        expect(renders).not.toHaveBeenCalled();
    });

    it("follows a controlled viewport, and tells every change", async () => {
        const changes: Viewport[] = [];
        function App() {
            const [viewport, setViewport] = React.useState<Viewport>({
                x: 0,
                y: 0,
                zoom: 1,
            });
            return (
                <>
                    <button
                        type="button"
                        onClick={() => setViewport({ x: 100, y: 50, zoom: 2 })}
                    >
                        move
                    </button>
                    <TestFlow
                        viewport={viewport}
                        onViewportChange={(next) => {
                            changes.push(next);
                            setViewport(next);
                        }}
                    >
                        <Flow.ZoomOut data-testid="out" />
                    </TestFlow>
                </>
            );
        }
        const { container, getByText, getByTestId } = render(<App />);
        await settle();
        fireEvent.click(getByText("move"));
        expect(part(container, "viewport").style.transform).toBe(
            "translate(100px, 50px) scale(2)",
        );
        fireEvent.click(getByTestId("out"));
        expect(changes.at(-1)?.zoom).toBeCloseTo(2 / 1.2);
        expect(part(container, "viewport").style.transform).toMatch(
            /scale\(1\.66/,
        );
    });

    it("fits the nodes with fitView once they are measured, and with Flow.FitView", async () => {
        const { container, getByTestId } = render(
            <TestFlow defaultNodes={pair().nodes} fitView>
                <Flow.FitView data-testid="fit" />
            </TestFlow>,
        );
        await settle();
        const fitted = part(container, "viewport").style.transform;
        expect(fitted).not.toBe("translate(0px, 0px) scale(1)");
        expect(getByTestId("fit")).not.toBeDisabled();
        fireEvent.click(getByTestId("fit"));
        expect(part(container, "viewport").style.transform).toBe(fitted);
    });

    it("applies engine props that change (the zoom limits) at once", async () => {
        function App({ maxZoom }: { maxZoom: number }) {
            return (
                <TestFlow
                    maxZoom={maxZoom}
                    defaultViewport={{ x: 0, y: 0, zoom: 2 }}
                >
                    <Flow.ZoomIn data-testid="in" />
                </TestFlow>
            );
        }
        const { container, getByTestId, rerender } = render(
            <App maxZoom={2} />,
        );
        await settle();
        expect(getByTestId("in")).toBeDisabled();
        rerender(<App maxZoom={4} />);
        expect(getByTestId("in")).not.toBeDisabled();
        rerender(<App maxZoom={1} />);
        expect(part(container, "viewport").style.transform).toMatch(
            /scale\(1\)/,
        );
    });

    it("sends only the engine props that changed: a lock by Flow.ToggleInteractive stays", async () => {
        function App({ minZoom }: { minZoom: number }) {
            return (
                <TestFlow interactive minZoom={minZoom}>
                    <Flow.ToggleInteractive data-testid="lock" />
                </TestFlow>
            );
        }
        const { container, getByTestId, rerender } = render(
            <App minZoom={0.5} />,
        );
        await settle();
        // an `interactive` that stays never undoes the lock (#33: the lock's switches)
        fireEvent.click(getByTestId("lock"));
        expect(getByTestId("lock")).toHaveAttribute("aria-pressed", "true");
        rerender(<App minZoom={0.25} />);
        expect(getByTestId("lock")).toHaveAttribute("aria-pressed", "true");
        expect(part(container, "root")).toHaveAttribute("data-interactive");
    });

    it("draws the background pattern at the viewport", async () => {
        const { container } = render(
            <Flow.Root defaultViewport={{ x: 5, y: 0, zoom: 2 }}>
                <Flow.Background variant="lines" gap={10} />
                <Flow.Viewport />
            </Flow.Root>,
        );
        await settle();
        const pattern = part(container, "background-pattern");
        expect(pattern.getAttribute("width")).toBe("20");
        expect(part(container, "background-mark").tagName.toLowerCase()).toBe(
            "path",
        );
        const fill = part(container, "background-fill");
        expect(fill.getAttribute("fill")).toBe(`url(#${pattern.id})`);
    });
});
