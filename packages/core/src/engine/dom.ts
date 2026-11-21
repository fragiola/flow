// The DOM the engine reaches, always through an element: its document and window (an iframe's or
// a popup's own, never the global ones), and what a press, a key or the wheel hit, read from the
// part attributes (D11).
import {
    ID_ATTRIBUTE,
    NO_GESTURE_ATTRIBUTE,
    PART_ATTRIBUTE,
    POSITION_ATTRIBUTE,
} from "../attributes/part-attributes";
import type { FlowHandle, PressTarget } from "./adapter";

/** The window an element renders in, if any (never the global one). */
export function viewOf(
    element: Element | null | undefined,
): Window | undefined {
    return element?.ownerDocument?.defaultView ?? undefined;
}

/** An event target as an element (a text node's parent), if it is one. */
export function asElement(target: EventTarget | null): Element | undefined {
    if (target === null || typeof target !== "object") return undefined;
    const node = target as Node;
    if (node.nodeType === 1) return node as Element;
    return node.parentElement ?? undefined;
}

/** What a press inside a node never starts a gesture from: its own controls. */
const NO_GESTURE = [
    "input",
    "textarea",
    "select",
    "option",
    "button",
    "a[href]",
    '[contenteditable]:not([contenteditable="false"])',
    `[${NO_GESTURE_ATTRIBUTE}]`,
].join(", ");

/** The parts that are the flow's background: a press there pans, or draws a selection box. */
const PANE_PARTS = new Set([
    "root",
    "viewport",
    "background",
    "nodes",
    "edges",
]);

const EDGE_PARTS = new Set(["edge", "edge-path", "edge-label"]);

const MINIMAP_PARTS = new Set(["minimap", "minimap-node", "minimap-mask"]);

const OTHER: PressTarget = { kind: "other", element: undefined };

/** The nearest element with a part attribute, from `element` up to `root`. */
function partOf(element: Element, root: Element): Element | undefined {
    const part = element.closest(`[${PART_ATTRIBUTE}]`);
    return part && root.contains(part) ? part : undefined;
}

function idOf(element: Element | null | undefined): string | undefined {
    return element?.getAttribute(ID_ATTRIBUTE) ?? undefined;
}

function nodeIdAround(element: Element, root: Element): string | undefined {
    const node = element.closest(`[${PART_ATTRIBUTE}="node"]`);
    return node && root.contains(node) ? idOf(node) : undefined;
}

/** What `target` (an event's) is in the flow under `root`. */
export function pressTargetOf(
    root: Element,
    target: EventTarget | null,
    handleOf: (element: Element) => FlowHandle | undefined,
): PressTarget {
    const element = asElement(target);
    if (!element || !root.contains(element)) return OTHER;
    const part = partOf(element, root);
    if (!part) return OTHER;
    // a control inside a part (a node's field) keeps its own presses
    const control = element.closest(NO_GESTURE);
    if (control && part.contains(control) && control !== part) {
        return { kind: "other", element: part };
    }
    const name = part.getAttribute(PART_ATTRIBUTE) ?? "";
    if (PANE_PARTS.has(name)) return { kind: "pane", element: part };
    if (name === "node") {
        return { kind: "node", element: part, nodeId: idOf(part) };
    }
    if (name === "handle") {
        const handle = handleOf(part);
        return handle
            ? { kind: "handle", element: part, nodeId: handle.nodeId, handle }
            : { kind: "other", element: part };
    }
    if (name === "resize-handle") {
        return {
            kind: "resize-handle",
            element: part,
            nodeId: nodeIdAround(part, root),
            position: part.getAttribute(POSITION_ATTRIBUTE) ?? undefined,
        };
    }
    if (EDGE_PARTS.has(name)) {
        const edge =
            name === "edge-label"
                ? part
                : (part.closest(`[${PART_ATTRIBUTE}="edge"]`) ?? part);
        return {
            kind: "edge",
            element: edge,
            edgeId: idOf(edge) ?? idOf(part),
        };
    }
    if (MINIMAP_PARTS.has(name)) {
        const minimap = part.closest(`[${PART_ATTRIBUTE}="minimap"]`) ?? part;
        return { kind: "minimap", element: minimap };
    }
    return { kind: "other", element: part };
}
