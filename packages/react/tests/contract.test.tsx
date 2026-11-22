// The primitive contract (guidelines components/primitives.md), for every primitive: a part
// attribute on every element, `render` as an element or a function (never `asChild`), `ref` as a
// prop merged with the primitive's, the consumer's handlers after the internal ones, `className`
// and `style` as a value or a function of the state, structural style that wins, and no text or
// name of its own.
import { connection } from "@fragiola/flow/connection";
import { minimap } from "@fragiola/flow/minimap";
import { resize } from "@fragiola/flow/resize";
import { selection } from "@fragiola/flow/selection";
import { fireEvent, render } from "@testing-library/react";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Flow, type FlowRef, useFlowRef } from "../src/index";
import { MiniMap, MiniMapMask, MiniMapNode } from "../src/minimap/index";
import { NodeResizer, ResizeHandle } from "../src/resize/index";
import { installLayout, pair, part, pointer, settle } from "./flow";

beforeEach(() => {
    installLayout();
});

const FEATURES = [selection(), connection(), resize(), minimap()] as const;

type Props = Record<string, unknown>;

/** The flow every case renders, with the primitive under test given `props` at its place. */
interface Case {
    /** the part the primitive's element carries */
    part: string;
    /** its default element */
    tag: string;
    /** a replacement element for `render` of the same kind (HTML or SVG) */
    replacement: () => React.ReactElement;
    /** the flow, with the primitive given `p` */
    flow: (p: Props) => React.ReactNode;
    /** what brings the primitive on screen (a gesture under way) */
    setup?: (container: HTMLElement) => void;
    /** a structural style key it sets, which a consumer's style does not override */
    structural?: [keyof React.CSSProperties, string, string];
}

/** The parts every case's flow is made of; `slot` names the one given the props. */
function flowWith(slot: string, p: Props): React.ReactNode {
    const at = (name: string) => (name === slot ? p : {});
    const { nodes, edges } = pair();
    return (
        <Flow.Root
            {...(at("root") as object)}
            features={FEATURES}
            defaultNodes={nodes.map((node) =>
                node.id === "a" ? { ...node, selected: true } : node,
            )}
            defaultEdges={edges}
        >
            <Flow.Background {...(at("background") as object)} />
            <Flow.Viewport {...(at("viewport") as object)}>
                <Flow.Edges {...(at("edges") as object)}>
                    {(edge) => (
                        <Flow.Edge {...(at("edge") as object)} edge={edge}>
                            <Flow.EdgePath {...(at("edge-path") as object)} />
                            <Flow.EdgeLabel {...(at("edge-label") as object)} />
                            <Flow.ReconnectAnchor
                                end="target"
                                {...(at("reconnect-anchor") as object)}
                            />
                            <Flow.EdgeToolbar
                                open
                                {...(at("edge-toolbar") as object)}
                            />
                        </Flow.Edge>
                    )}
                </Flow.Edges>
                <Flow.Nodes {...(at("nodes") as object)}>
                    {(node) => (
                        <Flow.Node {...(at("node") as object)} node={node}>
                            <Flow.Handle
                                type="target"
                                side="top"
                                {...(at("handle") as object)}
                            />
                            <Flow.Handle type="source" side="bottom" />
                            {node.id === "a" ? (
                                <>
                                    <NodeResizer {...(at("resizer") as object)}>
                                        <ResizeHandle
                                            position="bottom-right"
                                            {...(at("resize-handle") as object)}
                                        />
                                    </NodeResizer>
                                    <Flow.NodeToolbar
                                        {...(at("toolbar") as object)}
                                    />
                                </>
                            ) : null}
                        </Flow.Node>
                    )}
                </Flow.Nodes>
                <Flow.ConnectionLine {...(at("connection-line") as object)} />
            </Flow.Viewport>
            <Flow.SelectionBox {...(at("selection-box") as object)} />
            <Flow.Controls {...(at("controls") as object)}>
                <Flow.ZoomIn {...(at("zoom-in") as object)} />
                <Flow.ZoomOut {...(at("zoom-out") as object)} />
                <Flow.FitView {...(at("fit-view") as object)} />
                <Flow.ToggleInteractive
                    {...(at("toggle-interactive") as object)}
                />
            </Flow.Controls>
            <MiniMap {...(at("minimap") as object)}>
                <MiniMapNode nodeId="a" {...(at("minimap-node") as object)} />
                <MiniMapMask {...(at("minimap-mask") as object)} />
            </MiniMap>
        </Flow.Root>
    );
}

const div = () => <section />;

function simple(
    name: string,
    tag: string,
    replacement: () => React.ReactElement,
    extra: Partial<Case> = {},
): Case {
    return {
        part: name,
        tag,
        replacement,
        flow: (p) => flowWith(name, p),
        ...extra,
    };
}

/** A connection from `a`'s source handle, under way. */
function startConnection(container: HTMLElement) {
    const handle = container.querySelector(
        '[data-flow-id="a"] [data-handle-type="source"]',
    ) as Element;
    pointer(handle, "pointerdown", { clientX: 50, clientY: 40 });
    pointer(part(container, "root"), "pointermove", {
        clientX: 300,
        clientY: 300,
    });
}

/** A box selection, under way. */
function startBox(container: HTMLElement) {
    pointer(part(container, "viewport"), "pointerdown", {
        clientX: 400,
        clientY: 400,
        shiftKey: true,
    });
    pointer(part(container, "root"), "pointermove", {
        clientX: 500,
        clientY: 500,
        shiftKey: true,
    });
}

const CASES: Case[] = [
    simple("root", "div", div, {
        structural: ["position", "static", "relative"],
    }),
    simple("viewport", "div", div, {
        structural: ["position", "static", "absolute"],
    }),
    simple("nodes", "div", div, {
        structural: ["position", "static", "absolute"],
    }),
    {
        ...simple("node", "div", div, {
            structural: ["position", "static", "absolute"],
        }),
    },
    simple("handle", "div", div, {
        structural: ["position", "static", "absolute"],
    }),
    simple("edges", "div", div, {
        structural: ["pointerEvents", "auto", "none"],
    }),
    simple("edge", "g", () => <g />),
    simple("edge-path", "path", () => <path />),
    simple("edge-label", "div", div, {
        structural: ["position", "static", "absolute"],
    }),
    simple("reconnect-anchor", "circle", () => <circle />),
    simple("connection-line", "svg", () => <svg />, {
        setup: startConnection,
        structural: ["pointerEvents", "auto", "none"],
    }),
    simple("selection-box", "div", div, {
        setup: startBox,
        structural: ["position", "static", "absolute"],
    }),
    simple("background", "svg", () => <svg />, {
        structural: ["position", "static", "absolute"],
    }),
    simple("controls", "div", div),
    simple("zoom-in", "button", () => <button type="button" />),
    simple("zoom-out", "button", () => <button type="button" />),
    simple("fit-view", "button", () => <button type="button" />),
    simple("toggle-interactive", "button", () => <button type="button" />),
    simple("toolbar", "div", div, {
        structural: ["position", "static", "absolute"],
    }),
    {
        ...simple("toolbar", "div", div, {
            structural: ["position", "static", "absolute"],
        }),
        // the edge's toolbar: the same part
        flow: (p) => flowWith("edge-toolbar", p),
    },
    simple("minimap", "svg", () => <svg />),
    simple("minimap-node", "rect", () => <rect />),
    simple("minimap-mask", "path", () => <path />),
    simple("resizer", "div", div, {
        structural: ["position", "static", "absolute"],
    }),
    simple("resize-handle", "div", div, {
        structural: ["position", "static", "absolute"],
    }),
];

/** The primitive's element: the one carrying the case's marker. */
function find(container: HTMLElement, marker = "case"): HTMLElement {
    const element = container.querySelector<HTMLElement>(
        `[data-testid="${marker}"]`,
    );
    if (!element) throw new Error(`no [data-testid="${marker}"]`);
    return element;
}

async function mount(c: Case, p: Props) {
    const view = render(<>{c.flow(p)}</>);
    await settle();
    c.setup?.(view.container);
    return view;
}

describe.each(CASES)("the $part primitive", (c) => {
    it("renders its element with its part attribute, and a part attribute on every element it renders", async () => {
        const { container } = await mount(c, { "data-testid": "case" });
        const element = find(container);
        expect(element.tagName.toLowerCase()).toBe(c.tag);
        expect(element.getAttribute("data-flow-part")).toBe(c.part);
        for (const inner of element.querySelectorAll("*")) {
            expect(inner.hasAttribute("data-flow-part"), inner.outerHTML).toBe(
                true,
            );
        }
    });

    it("renders no text and no name of its own", async () => {
        const { container } = await mount(c, { "data-testid": "case" });
        const element = find(container);
        expect(element.textContent).toBe("");
        expect(element.hasAttribute("aria-label")).toBe(false);
        expect(element.querySelector("[aria-label]")).toBeNull();
    });

    it("merges its props into a render element", async () => {
        const { container } = await mount(c, {
            render: React.cloneElement(c.replacement(), {
                "data-testid": "case",
                "data-own": "yes",
            } as Props),
        });
        const element = find(container);
        expect(element.tagName.toLowerCase()).toBe(
            c.replacement().type as string,
        );
        expect(element.getAttribute("data-flow-part")).toBe(c.part);
        expect(element).toHaveAttribute("data-own", "yes");
    });

    it("calls a render function with its props and its state", async () => {
        const renderFn = vi.fn((props: Props, _state: unknown) =>
            React.createElement(c.replacement().type, {
                ...props,
                "data-testid": "case",
            }),
        );
        const { container } = await mount(c, { render: renderFn });
        const element = find(container);
        expect(element.getAttribute("data-flow-part")).toBe(c.part);
        const state = renderFn.mock.calls.at(-1)?.[1];
        expect(typeof state).toBe("object");
        expect(state).not.toBeNull();
    });

    it("takes ref as a prop, merged with its own", async () => {
        const ref = React.createRef<Element>();
        const { container } = await mount(c, { ref, "data-testid": "case" });
        // a primitive rendered for several entities (a node) gives the ref the last one
        expect([
            ...container.querySelectorAll('[data-testid="case"]'),
        ]).toContain(ref.current);
        expect(ref.current).not.toBeNull();
    });

    it("runs the consumer's handlers after its own", async () => {
        const onClick = vi.fn();
        const { container } = await mount(c, {
            onClick,
            "data-testid": "case",
        });
        fireEvent.click(find(container));
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("takes className and style as values or functions of its state", async () => {
        const className = vi.fn((_state: unknown) => "from-state");
        const style = vi.fn(() => ({ color: "red" }));
        const { container } = await mount(c, {
            className,
            style,
            "data-testid": "case",
        });
        const element = find(container);
        expect(element.getAttribute("class")).toBe("from-state");
        expect(element.style.color).toBe("red");
        expect(typeof className.mock.calls.at(-1)?.[0]).toBe("object");
        const plain = await mount(c, {
            className: "plain",
            style: { color: "blue" },
            "data-testid": "plain",
        });
        expect(find(plain.container, "plain").getAttribute("class")).toBe(
            "plain",
        );
    });

    it.runIf(c.structural !== undefined)(
        "keeps its structural style over the consumer's",
        async () => {
            const [key, mine, its] = c.structural ?? ["position", "", ""];
            const { container } = await mount(c, {
                style: { [key]: mine },
                "data-testid": "case",
            });
            expect(
                find(container).style[key as keyof CSSStyleDeclaration],
            ).toBe(its);
        },
    );
});

describe("the control buttons", () => {
    it("run their action before the consumer's onClick, and are disabled while the engine refuses it", async () => {
        const calls: string[] = [];
        let flow: FlowRef | undefined;
        function App() {
            const ref = useFlowRef();
            flow = ref;
            return (
                <Flow.Root flowRef={ref} maxZoom={1.2}>
                    <Flow.Viewport />
                    <Flow.ZoomIn
                        data-testid="in"
                        onClick={() =>
                            calls.push(
                                `zoom ${ref.current?.engine.get("viewport").zoom}`,
                            )
                        }
                    />
                    <Flow.ToggleInteractive data-testid="lock" />
                </Flow.Root>
            );
        }
        const { getByTestId } = render(<App />);
        await settle();
        fireEvent.click(getByTestId("in"));
        expect(calls).toEqual(["zoom 1.2"]);
        expect(getByTestId("in")).toBeDisabled();
        expect(getByTestId("in")).toHaveAttribute("data-disabled");
        fireEvent.click(getByTestId("lock"));
        expect(flow?.current?.engine.is("interactive")).toBe(false);
        expect(getByTestId("lock")).toHaveAttribute("aria-pressed", "true");
        expect(getByTestId("lock")).not.toHaveAttribute("data-interactive");
    });
});
