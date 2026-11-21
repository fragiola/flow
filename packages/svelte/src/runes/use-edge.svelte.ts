import {
    type AnyTypes,
    type EdgePath,
    type FlowEdge,
    type FlowTypes,
    type PartAttributes,
    partAttributes,
} from "@fragiola/flow";
import type { FlowContextValue } from "../context.js";
import { useFlowContext } from "../context.js";
import type { DataAttributes } from "../utils/render.js";
import { shallowEqual } from "../utils/shallow-equal.js";
import {
    type FlowValue,
    flowValue,
    type MaybeGetter,
    read,
} from "./internal.svelte.js";

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

/** What goes on an edge's element (an SVG group, `{...props}`). */
export type EdgeElementProps = {
    tabindex: number | undefined;
} & DataAttributes;

export interface UseEdgeResult<T extends FlowTypes = AnyTypes> {
    readonly state: EdgeState<T>;
    /** what goes on the edge's element (an SVG group): its attributes and `tabindex` */
    readonly props: EdgeElementProps;
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

/**
 * An edge's state and the props of its element, for an edge drawn by hand (`Flow.Edge` uses it).
 * Pass the edge, or a getter of it (`useEdge(() => edge)`) to follow a prop.
 */
export function useEdge<T extends FlowTypes = AnyTypes>(
    edge: MaybeGetter<FlowEdge<T>>,
): UseEdgeResult<T> {
    const context = useFlowContext("useEdge");
    const current = () => read(edge);
    const view = flowValue<EdgeView>(
        context,
        () => {
            const edgeId = current().id;
            const engine = context.engine;
            return engine
                ? {
                      attributes: engine.adapter.attributes("edge", { edgeId }),
                      path: engine.get("edge-path-by", { edgeId }),
                      reconnecting: engine.is("edge-reconnecting", { edgeId }),
                      focusable: engine.is("edge-focusable", { edgeId }),
                  }
                : {
                      attributes: partAttributes("edge", edgeId),
                      path: undefined,
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
    const state = $derived.by((): EdgeState<T> => {
        const { attributes, path, reconnecting, focusable } = view.current;
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
    const props = $derived.by(
        (): EdgeElementProps => ({
            ...(view.current.attributes as DataAttributes),
            tabindex: view.current.focusable ? 0 : undefined,
        }),
    );
    return {
        get state() {
            return state;
        },
        get props() {
            return props;
        },
    };
}

/** @internal an edge's path, notifying its readers when it changes (`Flow.EdgePath`, …) */
export function edgePathValue(
    context: FlowContextValue,
    edgeId: () => string,
): FlowValue<EdgePath | undefined> {
    return flowValue(
        context,
        () => context.engine?.get("edge-path-by", { edgeId: edgeId() }),
        sameEdgePath,
    );
}
