// What the tests share: a layout for jsdom (which lays nothing out, the React adapter's), a mount
// helper over TestBed (zoneless: a test waits for the fixture to be stable), and Pointer Events
// helpers that let Angular render. The flows themselves are standalone components
// (`tests/fixtures.ts`): templates are written in components.
import type { Type } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import type { FlowEdge, FlowNode, FlowNodeInput } from "@fragiola/flow";
import { vi } from "vitest";

/** The root's client box: at 0, 0, 800 × 600. */
export const ROOT_BOX = { left: 0, top: 0, width: 800, height: 600 };

/** A handle's size, in flow units. */
const HANDLE = 10;

function box(left: number, top: number, width: number, height: number) {
    return {
        left,
        top,
        width,
        height,
        x: left,
        y: top,
        right: left + width,
        bottom: top + height,
        toJSON: () => ({}),
    } as DOMRect;
}

/** The viewport an element is drawn at: its viewport element's transform (the engine's). */
function viewportOf(element: Element) {
    const viewport = element.closest<HTMLElement>(
        '[data-flow-part="viewport"]',
    );
    const match = viewport?.style.transform.match(
        /translate\((-?[\d.e-]+)px, (-?[\d.e-]+)px\) scale\(([\d.e-]+)\)/,
    );
    return match
        ? { x: Number(match[1]), y: Number(match[2]), zoom: Number(match[3]) }
        : { x: 0, y: 0, zoom: 1 };
}

/** A node element's flow box: its structural transform and its size. */
function nodeBox(element: HTMLElement) {
    const match = element.style.transform.match(
        /translate\((-?[\d.e-]+)px, (-?[\d.e-]+)px\)/,
    );
    return {
        x: Number(match?.[1] ?? 0),
        y: Number(match?.[2] ?? 0),
        width: Number.parseFloat(element.style.width || "0"),
        height: Number.parseFloat(element.style.height || "0"),
    };
}

/**
 * Lays the flow out as a browser would: the root at {@link ROOT_BOX}; a node at its transform with
 * its style's size (`offsetWidth` too); a handle a 10 × 10 box centred on its side; pointer
 * capture on every element. Call it once per test file (`beforeEach`).
 */
export function installLayout(): void {
    const proto = HTMLElement.prototype;
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
        function (this: Element) {
            const part = this.getAttribute("data-flow-part");
            if (part === "root")
                return box(
                    ROOT_BOX.left,
                    ROOT_BOX.top,
                    ROOT_BOX.width,
                    ROOT_BOX.height,
                );
            const view = viewportOf(this);
            const toClient = (x: number, y: number, w: number, h: number) =>
                box(
                    ROOT_BOX.left + view.x + x * view.zoom,
                    ROOT_BOX.top + view.y + y * view.zoom,
                    w * view.zoom,
                    h * view.zoom,
                );
            if (part === "node") {
                const node = nodeBox(this as HTMLElement);
                return toClient(node.x, node.y, node.width, node.height);
            }
            if (part === "handle") {
                const nodeElement = this.closest<HTMLElement>(
                    '[data-flow-part="node"]',
                );
                const node = nodeElement
                    ? nodeBox(nodeElement)
                    : { x: 0, y: 0, width: 0, height: 0 };
                const side = this.getAttribute("data-side");
                const cx =
                    side === "left"
                        ? 0
                        : side === "right"
                          ? node.width
                          : node.width / 2;
                const cy =
                    side === "top"
                        ? 0
                        : side === "bottom"
                          ? node.height
                          : node.height / 2;
                return toClient(
                    node.x + cx - HANDLE / 2,
                    node.y + cy - HANDLE / 2,
                    HANDLE,
                    HANDLE,
                );
            }
            if (part === "minimap") {
                const width = Number.parseFloat(
                    this.getAttribute("width") ?? "0",
                );
                const height = Number.parseFloat(
                    this.getAttribute("height") ?? "0",
                );
                return box(0, 0, width, height);
            }
            return box(0, 0, 0, 0);
        },
    );
    for (const name of ["offsetWidth", "offsetHeight"] as const) {
        vi.spyOn(proto, name, "get").mockImplementation(function (
            this: HTMLElement,
        ) {
            if (this.getAttribute("data-flow-part") !== "node") return 0;
            const node = nodeBox(this);
            return name === "offsetWidth" ? node.width : node.height;
        });
    }
    const captured = new WeakMap<Element, Set<number>>();
    const capturedOf = (element: Element) => {
        const set = captured.get(element) ?? new Set<number>();
        captured.set(element, set);
        return set;
    };
    Element.prototype.setPointerCapture = function (id: number) {
        capturedOf(this).add(id);
    };
    Element.prototype.hasPointerCapture = function (id: number) {
        return capturedOf(this).has(id);
    };
    Element.prototype.releasePointerCapture = function (id: number) {
        capturedOf(this).delete(id);
    };
}

/** The fixture of the test under way: what the event helpers wait for. */
let current: ComponentFixture<unknown> | undefined;

/** Lets Angular render (its effects, its after-render hooks) and the engine tell its measurements (a microtask). */
export async function settle(): Promise<void> {
    for (let i = 0; i < 3; i++) {
        await current?.whenStable();
        await new Promise((resolve) => setTimeout(resolve, 0));
    }
    await current?.whenStable();
}

/** A mounted component: its element, its instance, and how to change its inputs or destroy it. */
export interface Rendered<C> {
    readonly fixture: ComponentFixture<C>;
    readonly container: HTMLElement;
    readonly component: C;
    /** sets inputs of the component, then lets Angular render */
    set(inputs: Record<string, unknown>): Promise<void>;
    /** destroys the component (an unmount) */
    destroy(): void;
}

/** Mounts a component in the document (focus and events need it) with its inputs, then lets Angular settle. */
export async function render<C>(
    component: Type<C>,
    inputs: Record<string, unknown> = {},
): Promise<Rendered<C>> {
    const fixture = TestBed.createComponent(component);
    current = fixture as ComponentFixture<unknown>;
    const set = async (next: Record<string, unknown>) => {
        for (const [name, value] of Object.entries(next)) {
            fixture.componentRef.setInput(name, value);
        }
        await settle();
    };
    await set(inputs);
    return {
        fixture,
        container: fixture.nativeElement as HTMLElement,
        component: fixture.componentInstance,
        set,
        destroy: () => fixture.destroy(),
    };
}

/** Dispatches a Pointer Event on `target` (a mouse's primary button by default), then lets Angular render. */
export async function pointer(
    target: Element,
    type: string,
    init: PointerEventInit = {},
): Promise<void> {
    target.dispatchEvent(
        new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            pointerId: 1,
            isPrimary: true,
            pointerType: "mouse",
            button: 0,
            ...init,
        }),
    );
    await settle();
}

/** A press on `target`, moves and a release (captured: on the root), at client points. */
export async function drag(
    target: Element,
    root: Element,
    points: { clientX: number; clientY: number }[],
    init: PointerEventInit = {},
): Promise<void> {
    const [first, ...rest] = points;
    if (!first) return;
    await pointer(target, "pointerdown", { ...init, ...first });
    for (const point of rest) {
        await pointer(root, "pointermove", { ...init, ...point });
    }
    await pointer(root, "pointerup", { ...init, ...(rest.at(-1) ?? first) });
}

/** A key on `target`, then lets Angular render. */
export async function key(
    target: Element,
    name: string,
    init: KeyboardEventInit = {},
): Promise<void> {
    target.dispatchEvent(
        new KeyboardEvent("keydown", {
            key: name,
            bubbles: true,
            cancelable: true,
            ...init,
        }),
    );
    await settle();
}

/** A click on `target`, then lets Angular render. */
export async function click(target: Element): Promise<void> {
    target.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    await settle();
}

/** A wheel turn over `target`, at the root's centre. */
export async function wheel(target: Element, deltaY: number): Promise<void> {
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

/** A node of type `task` at a position, 100 × 40 (given: no measurement needed). */
export function task(
    id: string,
    x = 0,
    y = 0,
    extra: Partial<FlowNodeInput> = {},
): FlowNode {
    return {
        id,
        type: "task",
        position: { x, y },
        data: {},
        width: 100,
        height: 40,
        ...extra,
    } as FlowNode;
}

/** Two nodes `a`, `b` and an edge `ab` from `a`'s bottom to `b`'s top. */
export function pair(): { nodes: FlowNode[]; edges: FlowEdge[] } {
    return {
        nodes: [task("a", 0, 0), task("b", 0, 200)],
        edges: [{ id: "ab", source: "a", target: "b" } as FlowEdge],
    };
}

/** The element of a part (and an id). */
export function part(
    container: ParentNode,
    name: string,
    id?: string,
): HTMLElement {
    const selector =
        id === undefined
            ? `[data-flow-part="${name}"]`
            : `[data-flow-part="${name}"][data-flow-id="${id}"]`;
    const element = container.querySelector<HTMLElement>(selector);
    if (!element) throw new Error(`no ${selector}`);
    return element;
}
