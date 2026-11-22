// The primitive contract (guidelines components/primitives.md), in Angular, for every primitive:
// a directive goes on the app's own element, so React's `render` (another element) is the app's
// tag, and its state is the directive's `state()` through a template reference
// (`#n="flowNode"`) and its `data-*`. The part attribute is on every element (the ones a
// directive adds too), the app's attributes, `class`, `style` and handlers stay, the structural
// style wins, and no primitive has text or a name of its own.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFlowRef } from "../src/public-api";
import { ContractFlow, TestFlow } from "./fixtures";
import { click, installLayout, part, pointer, render, settle } from "./flow";

beforeEach(() => {
    installLayout();
});

/** One primitive's case. */
interface Case {
    /** the part the primitive's element carries */
    part: string;
    /** the app's element it is on in the contract flow */
    tag: string;
    /** what brings the primitive on screen (a gesture under way) */
    setup?: (container: HTMLElement) => Promise<void>;
    /** a structural style key it sets, which the app's style does not override */
    structural?: [string, string, string];
    /** the place in the flow given the inputs, when not its part's (the edge's toolbar) */
    slot?: string;
}

/** A connection from `a`'s source handle, under way. */
async function startConnection(container: HTMLElement) {
    const handle = container.querySelector(
        '[data-flow-id="a"] [data-handle-type="source"]',
    ) as Element;
    await pointer(handle, "pointerdown", { clientX: 50, clientY: 40 });
    await pointer(part(container, "root"), "pointermove", {
        clientX: 300,
        clientY: 300,
    });
}

/** A box selection, under way. */
async function startBox(container: HTMLElement) {
    await pointer(part(container, "viewport"), "pointerdown", {
        clientX: 400,
        clientY: 400,
        shiftKey: true,
    });
    await pointer(part(container, "root"), "pointermove", {
        clientX: 500,
        clientY: 500,
        shiftKey: true,
    });
}

const CASES: Case[] = [
    {
        part: "root",
        tag: "div",
        structural: ["position", "static", "relative"],
    },
    {
        part: "viewport",
        tag: "div",
        structural: ["position", "static", "absolute"],
    },
    {
        part: "nodes",
        tag: "div",
        structural: ["position", "static", "absolute"],
    },
    {
        part: "node",
        tag: "div",
        structural: ["position", "static", "absolute"],
    },
    {
        part: "handle",
        tag: "div",
        structural: ["position", "static", "absolute"],
    },
    {
        part: "edges",
        tag: "div",
        structural: ["pointer-events", "auto", "none"],
    },
    {
        part: "edge",
        tag: "g",
        structural: ["pointer-events", "auto", "visiblestroke"],
    },
    { part: "edge-path", tag: "path" },
    {
        part: "edge-label",
        tag: "div",
        structural: ["position", "static", "absolute"],
    },
    {
        part: "reconnect-anchor",
        tag: "circle",
        structural: ["pointer-events", "none", "all"],
    },
    {
        part: "connection-line",
        tag: "svg",
        setup: startConnection,
        structural: ["pointer-events", "auto", "none"],
    },
    {
        part: "selection-box",
        tag: "div",
        setup: startBox,
        structural: ["position", "static", "absolute"],
    },
    {
        part: "background",
        tag: "svg",
        structural: ["position", "static", "absolute"],
    },
    { part: "controls", tag: "div" },
    { part: "zoom-in", tag: "button" },
    { part: "zoom-out", tag: "button" },
    { part: "fit-view", tag: "button" },
    { part: "toggle-interactive", tag: "button" },
    {
        part: "toolbar",
        tag: "div",
        structural: ["position", "static", "absolute"],
    },
    {
        // the edge's toolbar: the same part
        part: "toolbar",
        slot: "edge-toolbar",
        tag: "div",
        structural: ["position", "static", "absolute"],
    },
    { part: "minimap", tag: "svg" },
    { part: "minimap-node", tag: "rect" },
    { part: "minimap-mask", tag: "path" },
    {
        part: "resizer",
        tag: "div",
        structural: ["position", "static", "absolute"],
    },
    {
        part: "resize-handle",
        tag: "div",
        structural: ["position", "static", "absolute"],
    },
];

/** The primitive's element: the one carrying the case's marker. */
function find(container: HTMLElement, marker = "case"): HTMLElement {
    const element = container.querySelector<HTMLElement>(
        `[data-testid="${marker}"]`,
    );
    if (!element) throw new Error(`no [data-testid="${marker}"]`);
    return element;
}

async function mount(c: Case, inputs: Record<string, unknown> = {}) {
    const view = await render(ContractFlow, {
        target: c.slot ?? c.part,
        ...inputs,
    });
    await c.setup?.(view.container);
    return view;
}

describe.each(CASES)("the $part primitive", (c) => {
    it("is on the app's element with its part attribute, and puts one on every element it adds", async () => {
        const { container } = await mount(c);
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
        const { container } = await mount(c);
        const element = find(container);
        expect(element.textContent?.trim()).toBe("");
        expect(element.hasAttribute("aria-label")).toBe(false);
        expect(element.querySelector("[aria-label]")).toBeNull();
    });

    it("gives its state to the template through its reference", async () => {
        const { container } = await mount(c);
        expect(find(container)).toHaveAttribute("data-state", "object");
    });

    it("keeps the app's class and style", async () => {
        const { container } = await mount(c, {
            classes: { plain: true, on: true },
            style: { color: "red", "--mark": "1" },
        });
        const element = find(container);
        expect(element).toHaveClass("plain", "on");
        expect(element.style.color).toBe("red");
        expect(element.style.getPropertyValue("--mark")).toBe("1");
    });

    it("runs the app's handlers", async () => {
        const onClick = vi.fn();
        const { container } = await mount(c, { onClick });
        await click(find(container));
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it.runIf(c.structural !== undefined)(
        "keeps its structural style over the app's",
        async () => {
            const [key, mine, its] = c.structural ?? ["position", "", ""];
            const { container } = await mount(c, { style: { [key]: mine } });
            expect(find(container).style.getPropertyValue(key)).toBe(its);
        },
    );
});

describe("the state", () => {
    it("reaches the template, and shows as data-* attributes", async () => {
        const { container } = await mount(CASES[3] as Case);
        expect(part(container, "node", "a")).toHaveAttribute("data-selected");
        expect(part(container, "node", "a")).toHaveAttribute(
            "data-selected-state",
            "true",
        );
        expect(part(container, "node", "b")).toHaveAttribute(
            "data-selected-state",
            "false",
        );
    });

    it('never writes "false" in a data-* attribute of its own', async () => {
        const { container } = await mount(CASES[0] as Case);
        const values = [...container.querySelectorAll("*")].flatMap((element) =>
            [...element.attributes]
                .filter(
                    ({ name }) =>
                        name.startsWith("data-") &&
                        name !== "data-selected-state",
                )
                .map(({ value }) => value),
        );
        expect(values).not.toContain("false");
    });

    it("never renders a text node of its own", async () => {
        const { container } = await mount(CASES[0] as Case);
        expect(part(container, "root").textContent?.trim()).toBe("");
    });
});

describe("the control buttons", () => {
    it("run their action before the app's handler, and are disabled while the engine refuses it", async () => {
        const calls: string[] = [];
        const flow = createFlowRef();
        const { container } = await render(TestFlow, {
            controls: true,
            flowRef: flow,
            maxZoom: 1.2,
            zoomInClick: () =>
                calls.push(`zoom ${flow.current?.engine.get("viewport").zoom}`),
        });
        const zoomIn = find(container, "in");
        expect(zoomIn).toHaveAttribute("type", "button");
        await click(zoomIn);
        expect(calls).toEqual(["zoom 1.2"]);
        expect(zoomIn).toBeDisabled();
        expect(zoomIn).toHaveAttribute("data-disabled");
        const lock = find(container, "lock");
        await click(lock);
        expect(flow.current?.engine.is("interactive")).toBe(false);
        expect(lock).toHaveAttribute("aria-pressed", "true");
        expect(lock).not.toHaveAttribute("data-interactive");
        await settle();
    });

    it("are disabled before the next task when their own click reaches the limit, and the app's click may allow it again", async () => {
        const { container } = await render(TestFlow, {
            controls: true,
            maxZoom: 1.2,
        });
        const zoomIn = find(container, "in");
        expect(zoomIn).not.toBeDisabled();
        zoomIn.dispatchEvent(
            new MouseEvent("click", { bubbles: true, cancelable: true }),
        );
        // the root renders in a microtask (renderSoon), not in Angular's later task
        await Promise.resolve();
        await Promise.resolve();
        expect(zoomIn).toBeDisabled();
        expect(zoomIn).toHaveAttribute("data-disabled", "");
        await settle();
        expect(zoomIn).toBeDisabled();
        const zoomOut = find(container, "out");
        await click(zoomOut);
        expect(zoomIn).not.toBeDisabled();
        expect(zoomIn).not.toHaveAttribute("data-disabled");
    });

    it("stay enabled when the app's click takes the zoom back from the limit in the same task", async () => {
        const flow = createFlowRef();
        const { container } = await render(TestFlow, {
            controls: true,
            flowRef: flow,
            maxZoom: 1.2,
            zoomInClick: () => flow.current?.engine.run("zoom-to", { zoom: 1 }),
        });
        const zoomIn = find(container, "in");
        await click(zoomIn);
        expect(flow.current?.engine.get("viewport").zoom).toBe(1);
        expect(zoomIn).not.toBeDisabled();
        expect(zoomIn).not.toHaveAttribute("data-disabled");
    });
});
