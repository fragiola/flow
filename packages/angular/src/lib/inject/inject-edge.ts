import { computed, type Signal } from "@angular/core";
import {
    type AnyTypes,
    type EdgePath,
    type FlowEdge,
    type FlowTypes,
    flag,
    type PartAttributes,
    partAttributes,
} from "@fragiola/flow";
import { type FlowContext, injectFlowContext } from "../context";
import {
    bindAttributes,
    bindStructuralStyle,
    injectHost,
} from "../utils/helpers";
import { shallowEqual } from "../utils/shallow-equal";
import { entityOf, flowValue, type ValueOrSignal, valueNow } from "./internal";

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

export interface InjectEdgeResult<T extends FlowTypes = AnyTypes> {
    /** the edge's state (`undefined` while its edge input is not set yet) */
    readonly state: Signal<EdgeState<T> | undefined>;
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
 * An edge's state, and its element bound (React's `useEdge`), for an edge drawn by hand: call it
 * in the constructor (or a field) of the component or directive whose host element is the edge
 * (an SVG group inside `[flowEdges]`; `[flowEdge]` uses it). The element gets the edge's
 * attributes, its `tabindex` and `pointer-events: visibleStroke`.
 */
export function injectEdge<T extends FlowTypes = AnyTypes>(
    edge: ValueOrSignal<FlowEdge<T>>,
): InjectEdgeResult<T> {
    return bindEdge<T>(
        injectFlowContext("injectEdge"),
        injectHost<SVGElement>(),
        () => valueNow(edge),
    );
}

/** @internal `injectEdge` over a context and an element */
export function bindEdge<T extends FlowTypes>(
    context: FlowContext,
    element: SVGElement | HTMLElement,
    edge: () => FlowEdge<T> | undefined,
): InjectEdgeResult<T> {
    const view = flowValue(
        context,
        (): EdgeView | undefined => {
            const edgeId = edge()?.id;
            if (edgeId === undefined) return undefined;
            const engine = context.engine();
            return engine
                ? {
                      attributes: engine.adapter.attributes("edge", { edgeId }),
                      path: engine.get("edge-path-by", { edgeId }),
                      reconnecting: engine.is("edge-reconnecting", { edgeId }),
                      focusable: engine.is("edge-focusable", { edgeId }),
                  }
                : {
                      attributes: staticEdgeAttributes(context, "edge", edgeId),
                      path: context.geometry()?.edgePaths[edgeId],
                      reconnecting: false,
                      focusable: false,
                  };
        },
        (a, b) =>
            a === b ||
            (a !== undefined &&
                b !== undefined &&
                a.reconnecting === b.reconnecting &&
                a.focusable === b.focusable &&
                sameEdgePath(a.path, b.path) &&
                shallowEqual(a.attributes, b.attributes)),
        {
            scope: "entity",
            entity: entityOf("edge", () => edge()?.id),
        },
    );
    const state = computed((): EdgeState<T> | undefined => {
        const current = edge();
        const shown = view();
        if (!current || !shown) return undefined;
        return {
            edgeId: current.id,
            edge: current,
            path: shown.path,
            selected: shown.attributes["data-selected"] !== undefined,
            reconnecting: shown.reconnecting,
            focusable: shown.focusable,
            attributes: shown.attributes,
        };
    });
    bindAttributes(element, () => {
        const shown = view();
        return shown
            ? {
                  ...shown.attributes,
                  tabindex: shown.focusable ? "0" : undefined,
              }
            : {};
    });
    bindStructuralStyle(element, () => ({ pointerEvents: "visibleStroke" }));
    return { state };
}

/**
 * @internal an edge part's attributes before the engine exists (the first render): the engine's
 * own for an edge, from the model (`data-selected`, `data-animated`), so nothing changes when it
 * comes
 */
export function staticEdgeAttributes(
    context: FlowContext,
    part: "edge" | "edge-path" | "edge-label",
    edgeId: string,
): PartAttributes {
    const edge = context.model().get("edge-by", { id: edgeId });
    return {
        ...partAttributes(part, edgeId),
        "data-selected": flag(edge?.selected === true),
        "data-animated": flag(edge?.animated === true),
    };
}

/** @internal an edge's path, as a signal that changes when it does (the static one before the engine) */
export function edgePathOf(
    context: FlowContext,
    edgeId: () => string | undefined,
): Signal<EdgePath | undefined> {
    return flowValue(
        context,
        () => {
            const id = edgeId();
            if (id === undefined) return undefined;
            const engine = context.engine();
            return engine
                ? engine.get("edge-path-by", { edgeId: id })
                : context.geometry()?.edgePaths[id];
        },
        sameEdgePath,
        {
            scope: "entity",
            entity: entityOf("edge", () => edgeId()),
        },
    );
}
