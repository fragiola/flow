// The primitive contract (guidelines components/primitives.md), in Svelte, for every primitive: a
// part attribute on every element, the `render` snippet (never `asChild`) given `{ props, state,
// children }`, `bind:ref` and the consumer's attachments on the primitive's element, the
// consumer's handlers after the internal ones, `class` and `style` as a value or a function of the
// state, structural style that wins, and no text or name of its own.
import { createRawSnippet } from "svelte";
import { createAttachmentKey } from "svelte/attachments";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFlowRef } from "../src/index";
import ContractFlow from "./fixtures/contract-flow.svelte";
import ControlsFlow from "./fixtures/controls-flow.svelte";
import * as snippets from "./fixtures/snippets.svelte";
import { click, installLayout, part, pointer, render, settle } from "./flow";

beforeEach(() => {
    installLayout();
    snippets.seen.length = 0;
});

type Given = Record<string | symbol, unknown>;

/** One primitive's case. */
interface Case {
    /** the part the primitive's element carries */
    part: string;
    /** its default element */
    tag: keyof typeof RENDER;
    /** what brings the primitive on screen (a gesture under way) */
    setup?: (container: HTMLElement) => Promise<void>;
    /** a structural style key it sets, which a consumer's style does not override */
    structural?: [string, string, string];
}

const RENDER = {
    div: snippets.div,
    button: snippets.button,
    svg: snippets.svg,
    g: snippets.g,
    path: snippets.path,
    circle: snippets.circle,
    rect: snippets.rect,
};

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
        structural: ["pointerEvents", "auto", "none"],
    },
    { part: "edge", tag: "g" },
    { part: "edge-path", tag: "path" },
    {
        part: "edge-label",
        tag: "div",
        structural: ["position", "static", "absolute"],
    },
    { part: "reconnect-anchor", tag: "circle" },
    {
        part: "connection-line",
        tag: "svg",
        setup: startConnection,
        structural: ["pointerEvents", "auto", "none"],
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

async function mount(c: Case, given: Given) {
    const view = await render(ContractFlow, { target: c.part, given });
    await c.setup?.(view.container);
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
        expect(element.textContent?.trim()).toBe("");
        expect(element.hasAttribute("aria-label")).toBe(false);
        expect(element.querySelector("[aria-label]")).toBeNull();
    });

    it("renders its render snippet with its props, its state and its content", async () => {
        const { container } = await mount(c, { render: RENDER[c.tag] });
        const element = find(container);
        expect(element.tagName.toLowerCase()).toBe(c.tag);
        expect(element.getAttribute("data-flow-part")).toBe(c.part);
        const state = snippets.seen.at(-1);
        expect(typeof state).toBe("object");
        expect(state).not.toBeNull();
    });

    it("gives its element to bind:ref, through its render snippet too", async () => {
        const own = await mount(c, { "data-testid": "case" });
        const refOf = own.component.refOf as (name: string) => Element | null;
        expect([
            ...own.container.querySelectorAll('[data-testid="case"]'),
        ]).toContain(refOf(c.part));
        own.unmount();
        const rendered = await mount(c, { render: RENDER[c.tag] });
        const renderedRef = rendered.component.refOf as (
            name: string,
        ) => Element | null;
        expect([
            ...rendered.container.querySelectorAll('[data-testid="case"]'),
        ]).toContain(renderedRef(c.part));
    });

    it("runs the consumer's attachments on its element", async () => {
        const attached = vi.fn();
        const { container } = await mount(c, {
            "data-testid": "case",
            [createAttachmentKey()]: (element: Element) => attached(element),
        });
        expect(attached).toHaveBeenCalledWith(find(container));
    });

    it("runs the consumer's handlers", async () => {
        const onclick = vi.fn();
        const { container } = await mount(c, {
            onclick,
            "data-testid": "case",
        });
        await click(find(container));
        expect(onclick).toHaveBeenCalledTimes(1);
    });

    it("takes class and style as values, any of Svelte's forms", async () => {
        const { container } = await mount(c, {
            class: ["plain", { on: true }],
            style: "color: red",
            "data-testid": "case",
        });
        const element = find(container);
        expect(element).toHaveClass("plain", "on");
        expect(element.style.color).toBe("red");
    });

    it("takes class and style as functions of its state", async () => {
        const className = vi.fn((state: unknown) =>
            typeof state === "object" ? "from-state" : "",
        );
        const { container } = await mount(c, {
            class: className,
            style: () => ({ color: "blue", "--mark": "1" }),
            "data-testid": "case",
        });
        const element = find(container);
        expect(element).toHaveClass("from-state");
        expect(element.style.color).toBe("blue");
        expect(element.style.getPropertyValue("--mark")).toBe("1");
        expect(typeof className.mock.calls.at(-1)?.[0]).toBe("object");
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

describe("the state", () => {
    it("reaches the render snippet, and shows as data-* attributes", async () => {
        const { container } = await mount(CASES[3] as Case, {
            render: RENDER.div,
        });
        expect(part(container, "node", "a")).toHaveAttribute("data-selected");
        const states = snippets.seen as {
            nodeId?: string;
            selected?: boolean;
        }[];
        const last = (nodeId: string) =>
            states.filter((state) => state.nodeId === nodeId).at(-1);
        expect(last("a")?.selected).toBe(true);
        expect(last("b")?.selected).toBe(false);
    });

    it('never writes "false" in a data-* attribute', async () => {
        const { container } = await mount(CASES[0] as Case, {});
        const values = [...container.querySelectorAll("*")].flatMap((element) =>
            [...element.attributes]
                .filter(({ name }) => name.startsWith("data-"))
                .map(({ value }) => value),
        );
        expect(values).not.toContain("false");
    });

    it("never renders a text node with text of its own", async () => {
        const { container } = await mount(CASES[0] as Case, {
            children: createRawSnippet(() => ({
                render: () => "<span></span>",
            })),
        });
        expect(part(container, "root").textContent?.trim()).toBe("");
    });
});

describe("the control buttons", () => {
    it("run their action before the consumer's handler, and are disabled while the engine refuses it", async () => {
        const calls: string[] = [];
        const flow = createFlowRef();
        const { container } = await render(ControlsFlow, {
            flowRef: flow,
            maxZoom: 1.2,
            zoomInClick: () =>
                calls.push(`zoom ${flow.current?.engine.get("viewport").zoom}`),
        });
        const zoomIn = find(container, "in");
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
});
