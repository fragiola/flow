import {
    type AnyTypes,
    type FlowNode,
    type FlowTypes,
    flag,
    type PartAttributes,
    partAttributes,
} from "@fragiola/flow";
import { type Attachment, createAttachmentKey } from "svelte/attachments";
import { useFlowContext } from "../context.js";
import { type DataAttributes, px, styleString } from "../utils/render.js";
import { flowValue, type MaybeGetter, read } from "./internal.svelte.js";

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

/** What goes on a node's element (`{...props}`). */
export type NodeElementProps = {
    tabindex: number | undefined;
    /** absolute, at its position, with the document's size when given */
    style: string;
    /** the attachment that registers the element with the engine (measured) */
    readonly [attachment: symbol]: Attachment<Element>;
} & DataAttributes;

export interface UseNodeResult<T extends FlowTypes = AnyTypes> {
    readonly state: NodeState<T>;
    /**
     * what goes on the node's element (`{...props}`): its attributes, `tabindex`, its structural
     * style and the attachment that registers it with the engine
     */
    readonly props: NodeElementProps;
}

interface NodeView {
    attributes: PartAttributes;
    x: number;
    y: number;
    /** its structural `z-index` (`node-z-index-by`); none without an engine */
    zIndex: number | undefined;
    focusable: boolean;
}

/**
 * A node's state and the props of its element, for a node rendered by hand (`Flow.Node` uses it).
 * Pass the node, or a getter of it (`useNode(() => node)`) to follow a prop; spread `props` on the
 * element (the engine resolves presses from its attributes).
 */
export function useNode<T extends FlowTypes = AnyTypes>(
    node: MaybeGetter<FlowNode<T>>,
): UseNodeResult<T> {
    const context = useFlowContext("useNode");
    const current = () => read(node);
    const view = flowValue<NodeView>(context, () => {
        const value = current();
        const nodeId = value.id;
        const { engine, model } = context;
        if (!engine) {
            const at = model.get("absolute-position-by", { nodeId });
            return {
                attributes: {
                    ...partAttributes("node", nodeId),
                    "data-selected": flag(value.selected === true),
                },
                x: at?.x ?? value.position.x,
                y: at?.y ?? value.position.y,
                zIndex: undefined,
                focusable: false,
            };
        }
        const rect = engine.get("node-rect-by", { nodeId });
        return {
            attributes: engine.adapter.attributes("node", { nodeId }),
            x: rect?.x ?? value.position.x,
            y: rect?.y ?? value.position.y,
            zIndex: engine.get("node-z-index-by", { nodeId }),
            focusable: engine.is("node-focusable", { nodeId }),
        };
    });
    // registered with the engine once both are there, again for another engine or node id only:
    // the id is derived, so that a new node object (each drag step) does not register it again
    const nodeId = $derived(current().id);
    const key = createAttachmentKey();
    const attachment: Attachment<Element> = (element) => {
        const id = nodeId;
        const engine = context.engine;
        if (!engine) return;
        engine.adapter.registerNode(id, element as HTMLElement);
        return () => engine.adapter.registerNode(id, null);
    };
    const state = $derived.by((): NodeState<T> => {
        const { attributes, x, y, focusable } = view.current;
        const value = current();
        return {
            nodeId: value.id,
            node: value,
            x,
            y,
            selected: attributes["data-selected"] !== undefined,
            dragging: attributes["data-dragging"] !== undefined,
            resizing: attributes["data-resizing"] !== undefined,
            measured: attributes["data-measured"] !== undefined,
            focusable,
            attributes,
        };
    });
    const props = $derived.by((): NodeElementProps => {
        const { attributes, x, y, zIndex, focusable } = view.current;
        const value = current();
        return {
            ...(attributes as DataAttributes),
            tabindex: focusable ? 0 : undefined,
            style: styleString(nodeStyle(x, y, zIndex, value)) ?? "",
            [key]: attachment,
        };
    });
    return {
        get state() {
            return state;
        },
        get props() {
            return props;
        },
    };
}

/** A node's structural style: absolute, at its position, its `z-index`, with the document's size. */
function nodeStyle(
    x: number,
    y: number,
    zIndex: number | undefined,
    node: { width?: number | undefined; height?: number | undefined },
): Record<string, string> {
    return {
        position: "absolute",
        top: "0",
        left: "0",
        transform: `translate(${px(x)}, ${px(y)})`,
        ...(zIndex === undefined ? {} : { "z-index": String(zIndex) }),
        ...(node.width === undefined ? {} : { width: px(node.width) }),
        ...(node.height === undefined ? {} : { height: px(node.height) }),
    };
}
