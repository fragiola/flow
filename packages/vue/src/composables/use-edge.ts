import {
    type AnyTypes,
    type EdgePath,
    type FlowEdge,
    type FlowTypes,
    flag,
    type PartAttributes,
    partAttributes,
} from "@fragiola/flow";
import {
    type ComputedRef,
    computed,
    type MaybeRefOrGetter,
    toValue,
} from "vue";
import { type FlowContextValue, useFlowContext } from "../context";
import { shallowEqual } from "../utils/shallow-equal";
import { useFlowValue } from "./internal";

/** What an edge shows: its state on screen. */
export interface EdgeState<T extends FlowTypes = AnyTypes> {
    readonly edgeId: string;
    /** the edge, as the model holds it */
    readonly edge: FlowEdge<T>;
    /**
     * its path, label point and ends (`edge-path-by`), once both its nodes have a size; an app
     * type gets the bezier path, and its ends to draw its own
     */
    readonly path: EdgePath | undefined;
    /** `data-selected` (`selection()`) */
    readonly selected: boolean;
    /** one of its ends is being moved (`reconnection()`) */
    readonly reconnecting: boolean;
    /** it takes DOM focus (`keyboard()`): `tabindex="0"` */
    readonly focusable: boolean;
    readonly attributes: PartAttributes;
}

/** What goes on an edge's element (an SVG group). */
export type EdgeElementProps = {
    tabindex: number | undefined;
} & Readonly<Record<`data-${string}`, string | undefined>>;

export interface UseEdgeResult<T extends FlowTypes = AnyTypes> {
    state: ComputedRef<EdgeState<T>>;
    /** what goes on the edge's element (`v-bind`): its attributes and `tabindex` */
    props: ComputedRef<EdgeElementProps>;
}

/** Two edge paths that draw the same (`edge-path-by` builds a new one at every read). */
export function sameEdgePath(
    a: EdgePath | undefined,
    b: EdgePath | undefined,
): boolean {
    if (a === b) return true;
    if (!a || !b) return false;
    return (
        a.path === b.path &&
        a.sourceSide === b.sourceSide &&
        a.targetSide === b.targetSide &&
        a.label.x === b.label.x &&
        a.label.y === b.label.y &&
        a.source.x === b.source.x &&
        a.source.y === b.source.y &&
        a.target.x === b.target.x &&
        a.target.y === b.target.y
    );
}

interface EdgeView {
    attributes: PartAttributes;
    path: EdgePath | undefined;
    reconnecting: boolean;
    focusable: boolean;
}

/** An edge's state and the props of its element, for an edge drawn by hand (`Flow.Edge` uses it). */
export function useEdge<T extends FlowTypes = AnyTypes>(
    edge: MaybeRefOrGetter<FlowEdge<T>>,
): UseEdgeResult<T> {
    const context = useFlowContext("useEdge");
    const current = () => toValue(edge);
    const view = useFlowValue<EdgeView>(
        context,
        () => {
            const edgeId = current().id;
            const engine = context.engine.value;
            return engine
                ? {
                      attributes: engine.adapter.attributes("edge", { edgeId }),
                      path: engine.get("edge-path-by", { edgeId }),
                      reconnecting: engine.is("edge-reconnecting", { edgeId }),
                      focusable: engine.is("edge-focusable", { edgeId }),
                  }
                : {
                      attributes: edgeAttributes(context, "edge", edgeId),
                      path: staticEdgePath(context, edgeId),
                      reconnecting: false,
                      focusable: false,
                  };
        },
        (a, b) =>
            a.reconnecting === b.reconnecting &&
            a.focusable === b.focusable &&
            sameEdgePath(a.path, b.path) &&
            shallowEqual(a.attributes, b.attributes),
    );
    const state = computed<EdgeState<T>>(() => {
        const { attributes, path, reconnecting, focusable } = view.value;
        const value = current();
        return {
            edgeId: value.id,
            edge: value,
            path,
            selected: attributes["data-selected"] !== undefined,
            reconnecting,
            focusable,
            attributes,
        };
    });
    const props = computed<EdgeElementProps>(() => ({
        ...view.value.attributes,
        tabindex: view.value.focusable ? 0 : undefined,
    }));
    return { state, props };
}

/** @internal an edge's path, triggering its readers when it changes (`Flow.EdgePath`, …) */
export function useEdgePath(
    context: FlowContextValue,
    edgeId: () => string,
): ComputedRef<EdgePath | undefined> {
    return useFlowValue(
        context,
        () => {
            const engine = context.engine.value;
            return engine
                ? engine.get("edge-path-by", { edgeId: edgeId() })
                : staticEdgePath(context, edgeId());
        },
        sameEdgePath,
    );
}

/** An edge's path before the engine exists: the static geometry's (absent until both sizes are known). */
function staticEdgePath(
    context: FlowContextValue,
    edgeId: string,
): EdgePath | undefined {
    return context.geometry.value?.edgePaths[edgeId];
}

/**
 * @internal the attributes of an edge's part (`edge`, `edge-path`, `edge-label`): the engine's, or
 * before it exists the same from the model (its id, `data-selected`, `data-animated`)
 */
export function edgeAttributes(
    context: FlowContextValue,
    part: "edge" | "edge-path" | "edge-label",
    edgeId: string,
): PartAttributes {
    const engine = context.engine.value;
    if (engine) return engine.adapter.attributes(part, { edgeId });
    const edge = context.model.get("edge-by", { id: edgeId });
    return {
        ...partAttributes(part, edgeId),
        "data-selected": flag(edge?.selected === true),
        "data-animated": flag(edge?.animated === true),
    };
}
