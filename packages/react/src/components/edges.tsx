import {
    type AnyTypes,
    edgesLayerAttributes,
    type FlowEdge,
    type FlowTypes,
    type PartAttributes,
    partAttributes,
} from "@fragiola/flow";
import * as React from "react";
import { EdgeLabelLayerContext, useFlowContext } from "../context";
import { useFlowValue } from "../hooks/internal";
import { shallowEqual } from "../utils/shallow-equal";
import {
    type DataAttributes,
    type DivPrimitiveProps,
    useRenderElement,
} from "../utils/use-render";

export interface EdgesState {
    /** how many edges are drawn */
    count: number;
}

export interface EdgesProps<T extends FlowTypes = AnyTypes>
    extends Omit<DivPrimitiveProps<EdgesState>, "children"> {
    /**
     * draws one edge: usually a `Flow.Edge` (an SVG group) with its path and label. A new function re-renders every
     * one: keep it stable (a module function, `useCallback`) when the app re-renders on each
     * change (controlled `nodes` / `edges`)
     */
    children: (edge: FlowEdge<T>) => React.ReactNode;
}

const LAYER_STYLE: React.CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    overflow: "visible",
    pointerEvents: "none",
};

const NO_EDGES: readonly FlowEdge[] = Object.freeze([]);

interface EdgeSlotProps {
    edge: FlowEdge;
    render: (edge: FlowEdge) => React.ReactNode;
}

// one edge's drawing, again only when its edge (or the children function) changes; its path
// re-renders by itself (`Flow.EdgePath` follows `edge-path-by`)
const EdgeSlot = React.memo(function EdgeSlot({ edge, render }: EdgeSlotProps) {
    return render(edge);
});

/** One render level's edges, and the attributes of its wrapper (none with one level). */
interface EdgeLevel {
    readonly level: number;
    readonly zIndex: number | undefined;
    readonly attributes: PartAttributes | undefined;
    readonly edges: readonly FlowEdge[];
}

function sameLevels(a: readonly EdgeLevel[], b: readonly EdgeLevel[]): boolean {
    return (
        a.length === b.length &&
        a.every((level, i) => {
            const other = b[i] as EdgeLevel;
            return (
                level.level === other.level &&
                level.zIndex === other.zIndex &&
                (level.attributes === other.attributes ||
                    (level.attributes !== undefined &&
                        other.attributes !== undefined &&
                        shallowEqual(level.attributes, other.attributes))) &&
                level.edges.length === other.edges.length &&
                level.edges.every((edge, j) => edge === other.edges[j])
            );
        })
    );
}

interface EdgeListProps {
    edges: readonly FlowEdge[];
    render: (edge: FlowEdge) => React.ReactNode;
}

// the SVG of a level's edges (`data-flow-part="edges"`)
function EdgeList({ edges, render }: EdgeListProps) {
    return (
        // biome-ignore lint/a11y/noSvgWithoutTitle: a layer of edges, not an image: each edge is the consumer's to name
        <svg {...partAttributes("edges")} style={LAYER_STYLE}>
            {edges.map((edge) => (
                <EdgeSlot key={edge.id} edge={edge} render={render} />
            ))}
        </svg>
    );
}

interface LevelLayerProps {
    level: EdgeLevel;
    render: (edge: FlowEdge) => React.ReactNode;
}

// one render level, with several (`data-flow-part="edges-layer"`, `data-level`): stacked at the
// level's z-index among the nodes, holding its edges' SVG and its edges' labels
function LevelLayer({ level, render }: LevelLayerProps) {
    const [layer, setLayer] = React.useState<HTMLElement | null>(null);
    return (
        <EdgeLabelLayerContext.Provider value={layer}>
            <div
                {...(level.attributes as DataAttributes)}
                ref={setLayer}
                style={{ ...LAYER_STYLE, zIndex: level.zIndex }}
            >
                <EdgeList edges={level.edges} render={render} />
            </div>
        </EdgeLabelLayerContext.Provider>
    );
}

/**
 * The layer of the edges (`data-flow-part="edges"`), inside `Flow.Viewport`, before `Flow.Nodes`:
 * an SVG (`data-flow-part="edges"` too) where `children` draws each edge, once both its nodes have
 * a size, in the engine's drawing order (`drawn-edges`: by `zIndex`), and the HTML layer edge
 * labels go to. When an edge stands above some node (`render-layers`: a selected edge with
 * `zIndexMode` `"auto"`, a high `zIndex`), each render level gets a wrapper of its own
 * (`data-flow-part="edges-layer"`, `data-level`, the level's `z-index`) holding its SVG and its
 * labels. Before the engine (the server render, the first client render) it draws the document's
 * static geometry (with `onlyRenderVisible`, no edge: the view is not known yet). It lets presses
 * through to the pane; the edges' own parts take them.
 */
export function Edges<T extends FlowTypes = AnyTypes>(props: EdgesProps<T>) {
    const { children, ...rest } = props;
    const { model, engine, staticGeometry, onlyRenderVisible } =
        useFlowContext("Edges");
    // the core's levels and drawing order: shown, measured, in view with `onlyRenderVisible`, by
    // z-order; the static geometry's before the engine
    const levels = useFlowValue<readonly EdgeLevel[]>(
        model,
        engine,
        () => {
            const layers = engine
                ? engine.get("render-layers")
                : (staticGeometry?.layers ?? []);
            const layered = layers.length > 1;
            // before the engine, a culled flow draws none: the view is not known yet
            const none = !engine && onlyRenderVisible;
            return layers.map((layer) => ({
                level: layer.level,
                zIndex: layer.zIndex,
                attributes: !layered
                    ? undefined
                    : engine
                      ? engine.adapter.attributes("edges-layer", {
                            level: layer.level,
                        })
                      : edgesLayerAttributes(layer.level),
                edges: none
                    ? NO_EDGES
                    : layer.edgeIds.flatMap((id) => {
                          const edge = model.get("edge-by", { id });
                          return edge ? [edge] : [];
                      }),
            }));
        },
        sameLevels,
    );
    const [layer, setLayer] = React.useState<HTMLElement | null>(null);
    const render = children as unknown as (edge: FlowEdge) => React.ReactNode;
    const count = levels.reduce((sum, level) => sum + level.edges.length, 0);
    const element = useRenderElement("div", rest, {
        state: { count },
        ref: setLayer as React.Ref<Element>,
        props: {
            ...partAttributes("edges"),
            children:
                levels.length > 1 ? (
                    levels.map((level) => (
                        <LevelLayer
                            key={level.level}
                            level={level}
                            render={render}
                        />
                    ))
                ) : (
                    <EdgeList edges={levels[0]?.edges ?? []} render={render} />
                ),
        },
        style: LAYER_STYLE,
    });
    return (
        <EdgeLabelLayerContext.Provider value={layer}>
            {element}
        </EdgeLabelLayerContext.Provider>
    );
}
