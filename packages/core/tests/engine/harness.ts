// A test adapter: renders a flow the way an adapter would (a root, a viewport, one element per
// node with its handles, one per edge), gives the elements a layout (sizes, client rects that
// follow the viewport), installs a fake `ResizeObserver` on the window, and stubs pointer capture
// (jsdom has none). Helpers dispatch Pointer Events, wheel and key events as a browser would.
import { vi } from "vitest";
import type { CommandEvent } from "../../src/commands/types";
import type { AnyTypes, FlowJson } from "../../src/document/types";
import type { HandleRegistration } from "../../src/engine/adapter";
import {
    createFlowEngine,
    type FlowEngine,
    type FlowEngineOptions,
} from "../../src/engine/create-flow-engine";
import type { FlowEngineEvent } from "../../src/engine/events";
import type { FlowFeatures } from "../../src/features/types";
import {
    createFlowModel,
    type FlowModel,
} from "../../src/model/create-flow-model";

/** A fake `ResizeObserver`: it records what it observes; `trigger` reports elements. */
export class FakeResizeObserver {
    static instances: FakeResizeObserver[] = [];
    readonly observed = new Set<Element>();
    constructor(readonly callback: (entries: { target: Element }[]) => void) {
        FakeResizeObserver.instances.push(this);
    }
    observe(target: Element): void {
        this.observed.add(target);
    }
    unobserve(target: Element): void {
        this.observed.delete(target);
    }
    disconnect(): void {
        this.observed.clear();
    }
    trigger(targets: Element[]): void {
        this.callback(targets.map((target) => ({ target })));
    }
}

export interface HandleSpec extends HandleRegistration {
    /** its top-left corner inside its node, in flow units */
    x: number;
    y: number;
    /** its size, in flow units (default 10) */
    size?: number;
}

export interface MountOptions<F extends FlowFeatures> {
    features?: F;
    engine?: FlowEngineOptions;
    /** each node's rendered size, in flow units (none: not measured) */
    sizes?: Record<string, [number, number]>;
    handles?: HandleSpec[];
    /** the root's client box; default 0, 0, 800 × 600 */
    root?: { left: number; top: number; width: number; height: number };
}

export interface Mounted<F extends FlowFeatures> {
    model: FlowModel<AnyTypes, F>;
    engine: FlowEngine<AnyTypes, F>;
    root: HTMLElement;
    viewport: HTMLElement;
    nodes: Map<string, HTMLElement>;
    handles: Map<string, HTMLElement>;
    edges: Map<string, SVGElement>;
    sizes: Map<string, [number, number]>;
    events: FlowEngineEvent[];
    commits: CommandEvent[];
    captured: Set<number>;
    observer(): FakeResizeObserver | undefined;
    node(id: string): HTMLElement;
    handle(nodeId: string, type: string, handleId?: string): HTMLElement;
    edge(id: string): SVGElement;
    /** renders an element for a node added later */
    addNode(id: string, size?: [number, number]): HTMLElement;
    /** the client point of a flow point */
    client(x: number, y: number): { clientX: number; clientY: number };
}

const SVG = "http://www.w3.org/2000/svg";

let mounted: (() => void)[] = [];

/** Unmounts every flow mounted since the last call (in `afterEach`). */
export function unmountAll(): void {
    for (const unmount of mounted) unmount();
    mounted = [];
    document.body.innerHTML = "";
    FakeResizeObserver.instances = [];
}

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

/** Mounts a flow: a model of `json`, its engine on a laid-out root. */
export function mount<const F extends FlowFeatures = readonly []>(
    json: FlowJson,
    options: MountOptions<F> = {},
): Mounted<F> {
    const view = window as Window & { ResizeObserver?: unknown };
    const original = view.ResizeObserver;
    view.ResizeObserver = FakeResizeObserver;
    const model = createFlowModel(json, {
        features: options.features,
    }) as unknown as Mounted<F>["model"];
    const engine = createFlowEngine(
        model,
        options.engine,
    ) as unknown as Mounted<F>["engine"];
    const rootBox = options.root ?? {
        left: 0,
        top: 0,
        width: 800,
        height: 600,
    };
    const root = document.createElement("div");
    root.setAttribute("data-flow-part", "root");
    root.getBoundingClientRect = () =>
        box(rootBox.left, rootBox.top, rootBox.width, rootBox.height);
    const captured = new Set<number>();
    root.setPointerCapture = vi.fn((id: number) => {
        captured.add(id);
    });
    root.hasPointerCapture = vi.fn((id: number) => captured.has(id));
    root.releasePointerCapture = vi.fn((id: number) => {
        captured.delete(id);
    });
    const viewportElement = document.createElement("div");
    viewportElement.setAttribute("data-flow-part", "viewport");
    const nodesLayer = document.createElement("div");
    nodesLayer.setAttribute("data-flow-part", "nodes");
    const edgesLayer = document.createElementNS(SVG, "svg");
    edgesLayer.setAttribute("data-flow-part", "edges");
    viewportElement.append(edgesLayer, nodesLayer);
    root.append(viewportElement);
    document.body.append(root);

    const sizes = new Map<string, [number, number]>(
        Object.entries(options.sizes ?? {}),
    );
    const nodes = new Map<string, HTMLElement>();
    const handles = new Map<string, HTMLElement>();
    const edges = new Map<string, SVGElement>();

    const nodeBox = (id: string) => {
        const position = model.get("absolute-position-by", { nodeId: id }) ?? {
            x: 0,
            y: 0,
        };
        const { x, y, zoom } = engine.get("viewport");
        const node = model.get("node-by", { id });
        const [width, height] = sizes.get(id) ?? [
            node?.width ?? 0,
            node?.height ?? 0,
        ];
        return box(
            rootBox.left + x + position.x * zoom,
            rootBox.top + y + position.y * zoom,
            width * zoom,
            height * zoom,
        );
    };

    const addNode = (id: string, size?: [number, number]) => {
        if (size) sizes.set(id, size);
        const element = document.createElement("div");
        element.setAttribute("data-flow-part", "node");
        element.setAttribute("data-flow-id", id);
        Object.defineProperty(element, "offsetWidth", {
            configurable: true,
            get: () => sizes.get(id)?.[0] ?? 0,
        });
        Object.defineProperty(element, "offsetHeight", {
            configurable: true,
            get: () => sizes.get(id)?.[1] ?? 0,
        });
        element.getBoundingClientRect = () => nodeBox(id);
        element.tabIndex = 0;
        nodesLayer.append(element);
        nodes.set(id, element);
        return element;
    };

    engine.adapter.attachRoot(root);
    engine.adapter.attachViewport(viewportElement);
    for (const node of model.get("all-nodes")) {
        const element = addNode(node.id);
        engine.adapter.registerNode(node.id, element);
    }
    for (const spec of options.handles ?? []) {
        const element = document.createElement("div");
        element.setAttribute("data-flow-part", "handle");
        if (spec.handleId) element.setAttribute("data-flow-id", spec.handleId);
        const size = spec.size ?? 10;
        element.getBoundingClientRect = () => {
            const parent = nodeBox(spec.nodeId);
            const { zoom } = engine.get("viewport");
            return box(
                parent.left + spec.x * zoom,
                parent.top + spec.y * zoom,
                size * zoom,
                size * zoom,
            );
        };
        nodes.get(spec.nodeId)?.append(element);
        handles.set(
            `${spec.nodeId}:${spec.type}:${spec.handleId ?? ""}`,
            element,
        );
        const { x: _x, y: _y, size: _size, ...registration } = spec;
        engine.adapter.registerHandle(registration, element);
    }
    for (const edge of model.get("all-edges")) {
        const group = document.createElementNS(SVG, "g");
        group.setAttribute("data-flow-part", "edge");
        group.setAttribute("data-flow-id", edge.id);
        const path = document.createElementNS(SVG, "path");
        path.setAttribute("data-flow-part", "edge-path");
        group.append(path);
        edgesLayer.append(group);
        edges.set(edge.id, group);
    }

    const events: FlowEngineEvent[] = [];
    engine.subscribe((event) => events.push(event));
    const commits: CommandEvent[] = [];
    model.subscribe((event) => commits.push(event));

    mounted.push(() => {
        engine.destroy();
        view.ResizeObserver = original;
    });

    const required = <V>(value: V | undefined, name: string): V => {
        if (value === undefined) throw new Error(`no ${name}`);
        return value;
    };

    return {
        model,
        engine,
        root,
        viewport: viewportElement,
        nodes,
        handles,
        edges,
        sizes,
        events,
        commits,
        captured,
        observer: () => FakeResizeObserver.instances.at(-1),
        node: (id) => required(nodes.get(id), `node ${id}`),
        handle: (nodeId, type, handleId) =>
            required(
                handles.get(`${nodeId}:${type}:${handleId ?? ""}`),
                "handle",
            ),
        edge: (id) => required(edges.get(id), `edge ${id}`),
        addNode,
        client: (x, y) => {
            const viewport = engine.get("viewport");
            return {
                clientX: rootBox.left + viewport.x + x * viewport.zoom,
                clientY: rootBox.top + viewport.y + y * viewport.zoom,
            };
        },
    };
}

/** Dispatches a Pointer Event on `target` (a mouse's primary button by default). */
export function pointer(
    target: EventTarget,
    type: string,
    init: PointerEventInit = {},
): PointerEvent {
    const event = new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        isPrimary: true,
        pointerType: "mouse",
        button: 0,
        ...init,
    });
    target.dispatchEvent(event);
    return event;
}

/** A press, moves and a release on `target` at client points (the moves and the release go to the root, as captured). */
export function drag(
    target: Element,
    root: Element,
    points: { clientX: number; clientY: number }[],
    init: PointerEventInit = {},
): void {
    const [first, ...rest] = points;
    if (!first) return;
    pointer(target, "pointerdown", { ...init, ...first });
    for (const point of rest)
        pointer(root, "pointermove", { ...init, ...point });
    pointer(root, "pointerup", { ...init, ...(rest.at(-1) ?? first) });
}

/** Dispatches a key on `target`. */
export function key(
    target: EventTarget,
    keyName: string,
    init: KeyboardEventInit = {},
): KeyboardEvent {
    const event = new KeyboardEvent("keydown", {
        key: keyName,
        bubbles: true,
        cancelable: true,
        ...init,
    });
    target.dispatchEvent(event);
    return event;
}

/** Dispatches a wheel event on `target`. */
export function wheel(target: EventTarget, init: WheelEventInit): WheelEvent {
    const event = new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        ...init,
    });
    target.dispatchEvent(event);
    return event;
}

/** A flow of nodes `a`, `b`, … at the given positions, with no edge. */
export function flowOf(
    positions: Record<string, [number, number]>,
    extra: Partial<FlowJson> = {},
): FlowJson {
    return {
        version: 1,
        nodes: Object.entries(positions).map(([id, [x, y]]) => ({
            id,
            type: "default",
            position: { x, y },
            data: {},
        })),
        edges: [],
        ...extra,
    };
}
