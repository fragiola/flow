import {
    type AnyTypes,
    type EdgePath,
    type FlowEdge,
    type FlowTypes,
    flag,
    type PartAttributes,
    partAttributes,
} from "@fragiola/flow";
import { useFlowContext } from "../context";
import { shallowEqual } from "../utils/shallow-equal";
import type { DataAttributes } from "../utils/use-render";
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

export interface UseEdgeResult<T extends FlowTypes = AnyTypes> {
    state: EdgeState<T>;
    /** what goes on the edge's element (an SVG group): its attributes and `tabIndex` */
    props: { tabIndex: number | undefined } & DataAttributes;
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
    edge: FlowEdge<T>,
): UseEdgeResult<T> {
    const { model, engine, staticGeometry } = useFlowContext("useEdge");
    const edgeId = edge.id;
    const view = useFlowValue<EdgeView>(
        model,
        engine,
        () =>
            engine
                ? {
                      attributes: engine.adapter.attributes("edge", { edgeId }),
                      path: engine.get("edge-path-by", { edgeId }),
                      reconnecting: engine.is("edge-reconnecting", { edgeId }),
                      focusable: engine.is("edge-focusable", { edgeId }),
                  }
                : {
                      attributes: staticEdgeAttributes("edge", edge),
                      path: staticGeometry?.edgePaths[edgeId],
                      reconnecting: false,
                      focusable: false,
                  },
        (a, b) =>
            a.reconnecting === b.reconnecting &&
            a.focusable === b.focusable &&
            sameEdgePath(a.path, b.path) &&
            shallowEqual(a.attributes, b.attributes),
        "entity",
        { kind: "edge", id: edgeId },
    );
    const { attributes } = view;
    return {
        state: {
            edgeId,
            edge,
            path: view.path,
            selected: attributes["data-selected"] !== undefined,
            reconnecting: view.reconnecting,
            focusable: view.focusable,
            attributes,
        },
        props: {
            ...(attributes as DataAttributes),
            tabIndex: view.focusable ? 0 : undefined,
        },
    };
}

/**
 * @internal an edge part's attributes before the engine (the server render, the first client
 * render): its part, its id, `data-selected` and `data-animated` from the document, as the
 * engine gives them
 */
export function staticEdgeAttributes(
    part: string,
    edge: {
        readonly id: string;
        readonly selected?: boolean | undefined;
        readonly animated?: boolean | undefined;
    },
): PartAttributes {
    return {
        ...partAttributes(part, edge.id),
        "data-selected": flag(edge.selected === true),
        "data-animated": flag(edge.animated === true),
    };
}

/**
 * @internal an edge's path, re-rendering when it changes (`Flow.EdgePath`, `Flow.EdgeLabel`): the
 * engine's, or the static geometry's before the engine
 */
export function useEdgePath(edgeId: string): EdgePath | undefined {
    const { model, engine, staticGeometry } = useFlowContext("EdgePath");
    return useFlowValue(
        model,
        engine,
        () =>
            engine
                ? engine.get("edge-path-by", { edgeId })
                : staticGeometry?.edgePaths[edgeId],
        sameEdgePath,
        "entity",
        { kind: "edge", id: edgeId },
    );
}
