// What the engine measures (D8, D9): each registered node's rendered size, with the
// `ResizeObserver` of the node's own window (`defaultView`), and each registered handle's box
// relative to its node, in flow units. Sizes are layout sizes (`offsetWidth`, unaffected by the
// viewport's scale); a handle's box comes from the client rects, divided by the zoom.
import type { Rect } from "../geometry/types";
import type { FlowHandle, HandleRegistration } from "./adapter";
import { viewOf } from "./dom";

/** A measured size, in flow units. */
export interface Size {
    readonly width: number;
    readonly height: number;
}

interface Observer {
    observe(target: Element): void;
    unobserve(target: Element): void;
    disconnect(): void;
}

type ObserverConstructor = new (
    callback: (entries: readonly { readonly target: Element }[]) => void,
) => Observer;

interface RegisteredHandle {
    readonly registration: HandleRegistration;
    /** its element; none once it went while its node stays in the flow (its last bounds kept) */
    readonly element: Element | undefined;
    bounds: Rect | undefined;
}

/** The key of a handle among all: its node, its type and its id. */
export function handleKey(
    nodeId: string,
    type: string,
    handleId: string | undefined,
): string {
    return `${nodeId}\u0000${type}\u0000${handleId ?? ""}`;
}

/** The measured nodes and handles of one engine. */
export class Measurements {
    private readonly nodes = new Map<string, HTMLElement>();
    private readonly nodeOfElement = new Map<Element, string>();
    private readonly sizes = new Map<string, Size>();
    private readonly handles = new Map<string, RegisteredHandle>();
    private readonly handleOfElement = new Map<Element, string>();
    /** each node's handle keys, in registration order */
    private readonly handlesByNode = new Map<string, Set<string>>();
    /** the nodes whose element went while they stayed in the flow: their last measurements kept */
    private readonly retired = new Set<string>();
    private observer: Observer | undefined;
    private observerView: Window | undefined;
    /**
     * the nodes whose size or handles changed since the engine last took them (`takeTouched`):
     * its geometry cache recomputes those and keeps the rest
     */
    private touched = new Set<string>();

    constructor(
        /** the current zoom: client rects are divided by it */
        private readonly zoom: () => number,
        /** something was measured: the nodes whose size or handles changed */
        private readonly measured: (nodeIds: readonly string[]) => void,
        /**
         * whether a node is still in the flow: a node whose element goes while it stays (culled by
         * `onlyRenderVisible`, hidden) keeps its last size and handles, so that it is not taken
         * for an unmeasured one (rendered again) and its edges keep their ends
         */
        private readonly inFlow: (nodeId: string) => boolean = () => false,
    ) {}

    /** Takes the nodes whose size or handles changed since the last call (none: nothing did). */
    takeTouched(): ReadonlySet<string> | undefined {
        if (this.touched.size === 0) return undefined;
        const touched = this.touched;
        this.touched = new Set();
        return touched;
    }

    /** A node's measured size, if it was measured. */
    size(nodeId: string): Size | undefined {
        return this.sizes.get(nodeId);
    }

    /** A node's registered element. */
    nodeElement(nodeId: string): HTMLElement | undefined {
        return this.nodes.get(nodeId);
    }

    registerNode(nodeId: string, element: HTMLElement | null): void {
        const previous = this.nodes.get(nodeId);
        if (previous === element) return;
        if (previous) {
            this.observer?.unobserve(previous);
            this.nodeOfElement.delete(previous);
            this.nodes.delete(nodeId);
        }
        if (!element) {
            if (this.inFlow(nodeId)) {
                this.retired.add(nodeId);
                return;
            }
            this.forget(nodeId);
            return;
        }
        this.retired.delete(nodeId);
        // React attaches a node's children before the node: a handle of it still without an
        // element was not rendered again (a node of another type now, its handles changed)
        for (const key of this.handlesByNode.get(nodeId) ?? []) {
            if (this.handles.get(key)?.element === undefined) {
                this.handles.delete(key);
                this.handlesByNode.get(nodeId)?.delete(key);
                this.touched.add(nodeId);
            }
        }
        this.nodes.set(nodeId, element);
        this.nodeOfElement.set(element, nodeId);
        const observer = this.observerFor(element);
        observer?.observe(element);
        // measured now too: an observer reports asynchronously, and one may be missing
        this.measure([nodeId]);
    }

    registerHandle(
        registration: HandleRegistration,
        element: Element | null,
    ): void {
        const key = handleKey(
            registration.nodeId,
            registration.type,
            registration.handleId,
        );
        const previous = this.handles.get(key);
        if (previous?.element) {
            if (previous.element !== element) {
                this.observer?.unobserve(previous.element);
            }
            this.handleOfElement.delete(previous.element);
        }
        if (
            !element &&
            previous &&
            !this.nodes.has(registration.nodeId) &&
            this.inFlow(registration.nodeId)
        ) {
            // its node's element went before it (React detaches a parent's ref first) and the node
            // stays in the flow: the handle keeps its last bounds, without an element
            this.handles.set(key, { ...previous, element: undefined });
            this.touched.add(registration.nodeId);
            return;
        }
        if (previous) {
            this.handles.delete(key);
            this.handlesByNode.get(registration.nodeId)?.delete(key);
            this.touched.add(registration.nodeId);
        }
        if (!element) {
            this.measured([registration.nodeId]);
            return;
        }
        this.handles.set(key, {
            registration: Object.freeze({ ...registration }),
            element,
            bounds: undefined,
        });
        this.handleOfElement.set(element, key);
        this.touched.add(registration.nodeId);
        const own =
            this.handlesByNode.get(registration.nodeId) ?? new Set<string>();
        own.add(key);
        this.handlesByNode.set(registration.nodeId, own);
        if (previous?.element !== element) {
            this.observerFor(element)?.observe(element);
        }
        this.measure([registration.nodeId]);
    }

    /** The handle an element is, if it was registered. */
    handleOf(
        element: Element,
        center: (handle: FlowHandle) => FlowHandle,
    ): FlowHandle | undefined {
        const key = this.handleOfElement.get(element);
        const entry = key === undefined ? undefined : this.handles.get(key);
        return entry ? center(this.view(entry)) : undefined;
    }

    /** A node's registered handles (their centres left for the engine to place). */
    handlesOf(nodeId: string): FlowHandle[] {
        const keys = this.handlesByNode.get(nodeId);
        if (!keys) return [];
        return [...keys].flatMap((key) => {
            const entry = this.handles.get(key);
            return entry ? [this.view(entry)] : [];
        });
    }

    /**
     * Every rendered handle (its centre left for the engine to place), in registration order: what
     * a connection may reach. A culled or hidden node's kept handles are not in it.
     */
    allHandles(): FlowHandle[] {
        return [...this.handles.values()]
            .filter((entry) => entry.element !== undefined)
            .map((entry) => this.view(entry));
    }

    /** Forgets the kept measurements of the nodes that left the flow while not rendered. */
    prune(): void {
        for (const nodeId of [...this.retired]) {
            if (!this.inFlow(nodeId)) this.forget(nodeId);
        }
    }

    /** Forgets a node's size and handles. */
    private forget(nodeId: string): void {
        this.retired.delete(nodeId);
        this.forgetHandles(nodeId);
        this.touched.add(nodeId);
        if (this.sizes.delete(nodeId)) this.measured([nodeId]);
    }

    private view(entry: RegisteredHandle): FlowHandle {
        const { registration, bounds } = entry;
        const connectable = registration.connectable !== false;
        return {
            nodeId: registration.nodeId,
            handleId: registration.handleId,
            type: registration.type,
            side: registration.side,
            connectable,
            connectableStart:
                connectable && registration.connectableStart !== false,
            connectableEnd:
                connectable && registration.connectableEnd !== false,
            center: undefined,
            bounds,
        };
    }

    /** Measures nodes again (their size and their handles). */
    measure(nodeIds: Iterable<string>): void {
        const changed: string[] = [];
        for (const nodeId of nodeIds) {
            const element = this.nodes.get(nodeId);
            if (!element) continue;
            let touched = false;
            const size = sizeOf(element, this.zoom());
            const before = this.sizes.get(nodeId);
            if (
                !before ||
                before.width !== size.width ||
                before.height !== size.height
            ) {
                this.sizes.set(nodeId, size);
                touched = true;
            }
            const nodeBox = element.getBoundingClientRect();
            const zoom = this.zoom() || 1;
            for (const key of this.handlesByNode.get(nodeId) ?? []) {
                const entry = this.handles.get(key);
                if (!entry?.element) continue;
                const box = entry.element.getBoundingClientRect();
                const bounds = {
                    x: (box.left - nodeBox.left) / zoom,
                    y: (box.top - nodeBox.top) / zoom,
                    width: box.width / zoom,
                    height: box.height / zoom,
                };
                const was = entry.bounds;
                if (
                    !was ||
                    was.x !== bounds.x ||
                    was.y !== bounds.y ||
                    was.width !== bounds.width ||
                    was.height !== bounds.height
                ) {
                    entry.bounds = bounds;
                    touched = true;
                }
            }
            if (touched) {
                changed.push(nodeId);
                this.touched.add(nodeId);
            }
        }
        if (changed.length > 0) this.measured(changed);
    }

    /** Forgets a node's handles (the node left the flow). */
    private forgetHandles(nodeId: string): void {
        for (const key of this.handlesByNode.get(nodeId) ?? []) {
            const entry = this.handles.get(key);
            if (entry?.element) {
                this.observer?.unobserve(entry.element);
                this.handleOfElement.delete(entry.element);
            }
            this.handles.delete(key);
        }
        this.handlesByNode.delete(nodeId);
    }

    /** Measures every registered node again (after a zoom, handles' client rects scale). */
    measureAll(): void {
        this.measure([...this.nodes.keys()]);
    }

    destroy(): void {
        this.observer?.disconnect();
        this.observer = undefined;
        this.nodes.clear();
        this.nodeOfElement.clear();
        this.sizes.clear();
        this.handles.clear();
        this.handleOfElement.clear();
        this.handlesByNode.clear();
        this.retired.clear();
        this.touched.clear();
    }

    /** The observer of an element's window, made once (an element of another window gets none). */
    private observerFor(element: Element): Observer | undefined {
        const view = viewOf(element);
        if (!view) return undefined;
        if (this.observer && this.observerView === view) return this.observer;
        if (this.observer) return undefined;
        const Constructor = (
            view as Window & { ResizeObserver?: ObserverConstructor }
        ).ResizeObserver;
        if (typeof Constructor !== "function") return undefined;
        this.observerView = view;
        this.observer = new Constructor((entries) => {
            const nodeIds = new Set<string>();
            for (const { target } of entries) {
                const nodeId =
                    this.nodeOfElement.get(target) ?? this.handleNodeOf(target);
                if (nodeId !== undefined) nodeIds.add(nodeId);
            }
            this.measure(nodeIds);
        });
        return this.observer;
    }

    private handleNodeOf(element: Element): string | undefined {
        const key = this.handleOfElement.get(element);
        return key === undefined
            ? undefined
            : this.handles.get(key)?.registration.nodeId;
    }
}

/** An element's layout size: `offsetWidth` for HTML, the client rect divided by the zoom otherwise. */
function sizeOf(element: Element, zoom: number): Size {
    const html = element as Partial<HTMLElement>;
    if (
        typeof html.offsetWidth === "number" &&
        typeof html.offsetHeight === "number"
    ) {
        return { width: html.offsetWidth, height: html.offsetHeight };
    }
    const box = element.getBoundingClientRect();
    return { width: box.width / (zoom || 1), height: box.height / (zoom || 1) };
}
