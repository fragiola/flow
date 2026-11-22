// #28: the edge toolbar, the toolbar of several nodes, focusable handles and resize handles
// (keyboard connection and resize through the adapter), and the simplebezier edge.
import { connection } from "@fragiola/flow/connection";
import { keyboard } from "@fragiola/flow/keyboard";
import { resize } from "@fragiola/flow/resize";
import { selection } from "@fragiola/flow/selection";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    type AnyTypes,
    Flow,
    type FlowFeatures,
    type FlowRef,
    type RootProps,
    useFlowRef,
} from "../src/index";
import { NodeResizer } from "../src/resize/index";
import { installLayout, key, part, settle, task } from "./flow";

beforeEach(() => {
    installLayout();
});

type Ref = FlowRef<AnyTypes, FlowFeatures>;

/** Nodes `a` (0, 0) and `b` (0, 200), an edge `ab` with a toolbar, and a toolbar over `nodeIds`. */
function ToolbarFlow(
    props: RootProps<AnyTypes, FlowFeatures> & {
        onRef: (ref: Ref) => void;
        edgeToolbar?: Record<string, unknown>;
        nodeIds?: readonly string[];
    },
) {
    const { onRef, edgeToolbar = {}, nodeIds, ...root } = props;
    const ref = useFlowRef<AnyTypes, FlowFeatures>();
    onRef(ref);
    return (
        <Flow.Root
            flowRef={ref}
            features={[selection()]}
            defaultNodes={[task("a", 0, 0), task("b", 0, 200)]}
            defaultEdges={[{ id: "ab", source: "a", target: "b" }]}
            {...root}
        >
            <Flow.Viewport>
                <Flow.Edges>
                    {(edge) => (
                        <Flow.Edge edge={edge}>
                            <Flow.EdgePath />
                            <Flow.EdgeToolbar
                                data-testid="edge-toolbar"
                                {...edgeToolbar}
                            >
                                <button type="button">x</button>
                            </Flow.EdgeToolbar>
                        </Flow.Edge>
                    )}
                </Flow.Edges>
                <Flow.Nodes>
                    {(node) => (
                        <Flow.Node node={node}>
                            <Flow.Handle type="target" side="top" />
                            <Flow.Handle type="source" side="bottom" />
                        </Flow.Node>
                    )}
                </Flow.Nodes>
            </Flow.Viewport>
            {nodeIds ? (
                <Flow.NodeToolbar
                    data-testid="nodes-toolbar"
                    nodeIds={nodeIds}
                />
            ) : null}
        </Flow.Root>
    );
}

describe("Flow.EdgeToolbar", () => {
    it("stands at its edge's label point outside the zoom while the edge is selected, and follows the viewport", async () => {
        let flow: Ref | undefined;
        const { container, queryByTestId } = render(
            <ToolbarFlow
                onRef={(ref) => {
                    flow = ref;
                }}
                defaultViewport={{ x: 0, y: 0, zoom: 2 }}
            />,
        );
        await settle();
        await settle();
        expect(queryByTestId("edge-toolbar")).toBeNull();
        flow?.current?.model.run("selection.set", { edgeIds: ["ab"] });
        await settle();
        const toolbar = queryByTestId("edge-toolbar") as HTMLElement;
        expect(toolbar.parentElement).toBe(part(container, "root"));
        expect(toolbar).toHaveAttribute("data-flow-part", "toolbar");
        expect(toolbar).toHaveAttribute("data-flow-id", "ab");
        expect(toolbar.tagName.toLowerCase()).toBe("div");
        expect(toolbar.querySelector("button")).toBeInstanceOf(
            HTMLButtonElement,
        );
        const at = flow?.current?.engine.get("edge-toolbar-by", {
            edgeId: "ab",
        });
        // the label point of a's bottom (50, 40) to b's top (50, 200), at zoom 2
        expect(at).toMatchObject({ x: 100, y: 240 });
        expect(toolbar.style.position).toBe("absolute");
        expect(toolbar.style.transform).toBe(
            "translate(100px, 240px) translate(-50%, -50%)",
        );
        flow?.current?.engine.run("set-viewport", { x: 10, y: 20, zoom: 1 });
        await settle();
        expect(toolbar.style.transform).toBe(
            "translate(60px, 140px) translate(-50%, -50%)",
        );
        flow?.current?.model.run("selection.clear");
        await settle();
        expect(queryByTestId("edge-toolbar")).toBeNull();
    });

    it("stands at an end with an offset, and open decides whether it is shown", async () => {
        let flow: Ref | undefined;
        const onRef = (ref: Ref) => {
            flow = ref;
        };
        const { queryByTestId, rerender } = render(
            <ToolbarFlow
                onRef={onRef}
                edgeToolbar={{
                    open: true,
                    position: "source",
                    offset: { x: 5, y: -8 },
                }}
            />,
        );
        await settle();
        await settle();
        const toolbar = queryByTestId("edge-toolbar") as HTMLElement;
        // a's bottom centre (50, 40), moved by the offset
        expect(toolbar.style.transform).toBe(
            "translate(55px, 32px) translate(-50%, -50%)",
        );
        rerender(
            <ToolbarFlow
                onRef={onRef}
                edgeToolbar={{ open: true, position: "target" }}
            />,
        );
        await settle();
        expect(queryByTestId("edge-toolbar")?.style.transform).toBe(
            "translate(50px, 200px) translate(-50%, -50%)",
        );
        flow?.current?.model.run("selection.set", { edgeIds: ["ab"] });
        rerender(<ToolbarFlow onRef={onRef} edgeToolbar={{ open: false }} />);
        await settle();
        expect(queryByTestId("edge-toolbar")).toBeNull();
    });

    it("needs an edge: inside Flow.Edge or given an edgeId", () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        expect(() =>
            render(
                <Flow.Root>
                    <Flow.EdgeToolbar />
                </Flow.Root>,
            ),
        ).toThrow(/Flow\.EdgeToolbar must be rendered inside Flow\.Edge/);
    });
});

describe("Flow.NodeToolbar with nodeIds", () => {
    it("stands beside the nodes' bounds, shown while every one of them is selected", async () => {
        let flow: Ref | undefined;
        const { container, queryByTestId } = render(
            <ToolbarFlow
                onRef={(ref) => {
                    flow = ref;
                }}
                nodeIds={["a", "b"]}
            />,
        );
        await settle();
        await settle();
        expect(queryByTestId("nodes-toolbar")).toBeNull();
        flow?.current?.model.run("selection.set", { nodeIds: ["a"] });
        await settle();
        expect(queryByTestId("nodes-toolbar")).toBeNull();
        flow?.current?.model.run("selection.set", { nodeIds: ["a", "b"] });
        await settle();
        const toolbar = queryByTestId("nodes-toolbar") as HTMLElement;
        expect(toolbar.parentElement).toBe(part(container, "root"));
        expect(toolbar).toHaveAttribute("data-flow-part", "toolbar");
        expect(toolbar).not.toHaveAttribute("data-flow-id");
        // the bounds (0, 0, 100, 240): their top centre, 10 pixels above
        expect(toolbar.style.transform).toBe(
            "translate(50px, -10px) translate(-50%, -100%)",
        );
    });
});

/** A flow with handles and resize handles, with the given features. */
function KeyboardFlow(props: RootProps<AnyTypes, FlowFeatures>) {
    return (
        <Flow.Root
            defaultNodes={[task("a", 0, 0), task("b", 0, 200)]}
            {...props}
        >
            <Flow.Viewport>
                <Flow.Edges>{(edge) => <Flow.Edge edge={edge} />}</Flow.Edges>
                <Flow.Nodes>
                    {(node) => (
                        <Flow.Node node={node}>
                            <Flow.Handle type="target" side="top" />
                            <Flow.Handle type="source" side="bottom" />
                            <NodeResizer />
                        </Flow.Node>
                    )}
                </Flow.Nodes>
                <Flow.ConnectionLine />
            </Flow.Viewport>
        </Flow.Root>
    );
}

describe("focusable handles and resize handles", () => {
    it("take focus only with keyboard() and their feature, as tabIndex", async () => {
        const errors = vi.spyOn(console, "error");
        const cases = [
            {
                features: [connection(), resize()],
                handle: false,
                resizer: false,
            },
            { features: [keyboard()], handle: false, resizer: false },
            {
                features: [keyboard(), connection()],
                handle: true,
                resizer: false,
            },
            { features: [resize(), keyboard()], handle: false, resizer: true },
        ];
        for (const c of cases) {
            const { container, unmount } = render(
                <KeyboardFlow features={c.features} />,
            );
            await settle();
            const handle = container.querySelector(
                '[data-flow-part="handle"]',
            ) as HTMLElement;
            const resizeHandle = container.querySelector(
                '[data-flow-part="resize-handle"]',
            ) as HTMLElement;
            expect(handle.getAttribute("tabindex")).toBe(c.handle ? "0" : null);
            expect(resizeHandle.getAttribute("tabindex")).toBe(
                c.resizer ? "0" : null,
            );
            unmount();
        }
        // React takes the engine's `tabindex` as `tabIndex`: no unknown-prop warning
        expect(errors).not.toHaveBeenCalled();
    });

    it("connect from the keyboard: Enter starts, Tab marks the target, Enter adds the edge", async () => {
        let flow: Ref | undefined;
        function App() {
            const ref = useFlowRef<AnyTypes, FlowFeatures>();
            flow = ref;
            return (
                <KeyboardFlow
                    flowRef={ref}
                    features={[keyboard(), connection()]}
                />
            );
        }
        const { container } = render(<App />);
        await settle();
        const source = container.querySelector(
            '[data-flow-id="a"] [data-handle-type="source"]',
        ) as HTMLElement;
        const target = container.querySelector(
            '[data-flow-id="b"] [data-handle-type="target"]',
        ) as HTMLElement;
        source.focus();
        key(source, "Enter");
        await settle();
        expect(source).toHaveAttribute("data-connecting");
        key(source, "Tab");
        await settle();
        expect(target).toHaveAttribute("data-valid");
        key(source, "Enter");
        await settle();
        expect(flow?.current?.model.get("all-edges")).toMatchObject([
            { source: "a", target: "b" },
        ]);
        expect(source).not.toHaveAttribute("data-connecting");
    });

    it("resize from the keyboard: an arrow on a focused resize handle moves its side", async () => {
        const { container } = render(
            <KeyboardFlow features={[keyboard(), resize()]} />,
        );
        await settle();
        const right = part(container, "node", "a").querySelector(
            '[data-position="right"]',
        ) as HTMLElement;
        right.focus();
        key(right, "ArrowRight");
        await settle();
        expect(part(container, "node", "a").style.width).not.toBe("100px");
    });
});

describe("the simplebezier edge", () => {
    it("is drawn by the default edge path", async () => {
        let flow: Ref | undefined;
        const { container } = render(
            <ToolbarFlow
                onRef={(ref) => {
                    flow = ref;
                }}
                defaultEdges={[
                    {
                        id: "ab",
                        source: "a",
                        target: "b",
                        type: "simplebezier",
                    },
                ]}
            />,
        );
        await settle();
        const d = part(container, "edge-path", "ab").getAttribute("d");
        expect(d).toBe(
            flow?.current?.engine.get("edge-path-by", { edgeId: "ab" })?.path,
        );
        expect(d).toMatch(/^M ?50[ ,]40/);
    });
});
