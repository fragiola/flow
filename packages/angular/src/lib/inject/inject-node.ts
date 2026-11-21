import {
    afterRenderEffect,
    computed,
    type Signal,
    untracked,
} from "@angular/core";
import {
    type AnyTypes,
    type FlowNode,
    type FlowTypes,
    flag,
    type PartAttributes,
    partAttributes,
} from "@fragiola/flow";
import { type FlowContext, injectFlowContext } from "../context";
import {
    type AttributeRecord,
    bindAttributes,
    bindStructuralStyle,
    injectHost,
    px,
    type StructuralStyle,
} from "../utils/helpers";
import { flowValue, type ValueOrSignal, valueNow } from "./internal";

/** What a node shows: its state on screen. */
export interface NodeState<T extends FlowTypes = AnyTypes> {
    readonly nodeId: string;
    /** the node, as the model holds it */
    readonly node: FlowNode<T>;
    /** its top-left corner in absolute flow coordinates (its parents' positions added) */
    readonly x: number;
    readonly y: number;
    /** `data-selected` (`selection()`) */
    readonly selected: boolean;
    /** `data-dragging` (`drag()`) */
    readonly dragging: boolean;
    /** `data-resizing` (`resize()`) */
    readonly resizing: boolean;
    /** its size is known (measured or given): `data-measured` */
    readonly measured: boolean;
    /** it takes DOM focus (`keyboard()`): `tabindex="0"` */
    readonly focusable: boolean;
    /** the attributes its element carries (`data-flow-part`, `data-flow-id`, the state) */
    readonly attributes: PartAttributes;
}

/** What a node's element gets: its attributes (`tabindex` too) and its structural style. */
export interface NodeElementProps {
    readonly attributes: AttributeRecord;
    readonly style: StructuralStyle;
}

export interface InjectNodeResult<T extends FlowTypes = AnyTypes> {
    /** the node's state (`undefined` while its node input is not set yet) */
    readonly state: Signal<NodeState<T> | undefined>;
    /** what the element is given (applied already) */
    readonly props: Signal<NodeElementProps>;
}

interface NodeView {
    attributes: PartAttributes;
    x: number;
    y: number;
    focusable: boolean;
}

/**
 * A node's state, and its element bound (React's `useNode`), for a node rendered by hand: call it
 * in the constructor (or a field) of the component or directive whose host element is the node
 * (`[flowNode]` uses it). That element gets the node's attributes, its `tabindex`, its structural
 * style (absolute, at its place, with the document's size when given) and is registered with the
 * engine, which measures it and resolves presses on it.
 *
 * ```ts
 * @Component({ selector: "article[appNode]", template: "…" })
 * class AppNode {
 *     readonly node = input.required<FlowNode<Types>>({ alias: "appNode" });
 *     readonly own = injectNode(this.node);
 * }
 * ```
 */
export function injectNode<T extends FlowTypes = AnyTypes>(
    node: ValueOrSignal<FlowNode<T>>,
): InjectNodeResult<T> {
    return bindNode<T>(injectFlowContext("injectNode"), injectHost(), () =>
        valueNow(node),
    );
}

/** @internal `injectNode` over a context and an element */
export function bindNode<T extends FlowTypes>(
    context: FlowContext,
    element: HTMLElement,
    node: () => FlowNode<T> | undefined,
): InjectNodeResult<T> {
    const nodeId = computed(() => node()?.id);
    const view = flowValue(context, (): NodeView | undefined => {
        const current = node() as FlowNode | undefined;
        if (!current) return undefined;
        const id = current.id;
        const engine = context.engine();
        const model = context.model();
        if (!engine) {
            const at = model.get("absolute-position-by", { nodeId: id });
            return {
                attributes: {
                    ...partAttributes("node", id),
                    "data-selected": flag(current.selected === true),
                },
                x: at?.x ?? current.position.x,
                y: at?.y ?? current.position.y,
                focusable: false,
            };
        }
        const rect = engine.get("node-rect-by", { nodeId: id });
        return {
            attributes: engine.adapter.attributes("node", { nodeId: id }),
            x: rect?.x ?? current.position.x,
            y: rect?.y ?? current.position.y,
            focusable: engine.is("node-focusable", { nodeId: id }),
        };
    });
    const state = computed((): NodeState<T> | undefined => {
        const current = node();
        const shown = view();
        if (!current || !shown) return undefined;
        const { attributes } = shown;
        return {
            nodeId: current.id,
            node: current,
            x: shown.x,
            y: shown.y,
            selected: attributes["data-selected"] !== undefined,
            dragging: attributes["data-dragging"] !== undefined,
            resizing: attributes["data-resizing"] !== undefined,
            measured: attributes["data-measured"] !== undefined,
            focusable: shown.focusable,
            attributes,
        };
    });
    const props = computed((): NodeElementProps => {
        const current = node();
        const shown = view();
        if (!current || !shown) return { attributes: {}, style: {} };
        return {
            attributes: {
                ...shown.attributes,
                tabindex: shown.focusable ? "0" : undefined,
            },
            style: {
                position: "absolute",
                top: 0,
                left: 0,
                transform: `translate(${shown.x}px, ${shown.y}px)`,
                width: px(current.width),
                height: px(current.height),
            },
        };
    });
    bindAttributes(element, () => props().attributes);
    bindStructuralStyle(element, () => props().style);
    // registered once per engine and node id: a move or a selection registers nothing again
    afterRenderEffect((onCleanup) => {
        const engine = context.engine();
        const id = nodeId();
        if (!engine || id === undefined) return;
        untracked(() => {
            engine.adapter.registerNode(id, element);
            onCleanup(() => engine.adapter.registerNode(id, null));
        });
    });
    return { state, props };
}
