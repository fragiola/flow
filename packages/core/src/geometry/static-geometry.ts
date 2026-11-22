// The geometry of a flow without an engine (a server render, the first client render): node boxes
// from the sizes the document gives (`width` / `height`, else `initialWidth` / `initialHeight`),
// edge ends at the declared `handles` (else the `sourcePosition` / `targetPosition` side), the
// paths, the drawing order and the render layers. It runs the very functions the engine runs
// before a node is measured, so the first render and the engine agree (no hydration jump). Pure:
// no DOM and nothing of the engine.
import type {
    AnyTypes,
    FlowEdge,
    FlowNode,
    FlowTypes,
    XY,
} from "../document/types";
import { edgeEnds, type PathOptions, pathOf } from "./edge-geometry";
import {
    declaredHandleOf,
    type NodeLayout,
    nodeRectOf,
    nodeSize,
} from "./node-layout";
import type { EdgePath, Rect } from "./types";
import {
    drawingOrder,
    edgeStackValue,
    nodeStackValue,
    type RenderLayer,
    renderLayers,
    type ZIndexMode,
} from "./z-order";

/** The engine options the static geometry follows (give it the root's, so both agree). */
export interface StaticGeometryOptions {
    /** the point of a node's box its position stands at, as shares of its size; default top-left */
    readonly nodeOrigin?: XY | undefined;
    /** the shape of the built-in edge paths (an edge's own `pathOptions` go over them) */
    readonly pathOptions?: PathOptions | undefined;
    /** how stack values are worked out; default `"auto"` */
    readonly zIndexMode?: ZIndexMode | undefined;
    /** a selected node is raised; default true */
    readonly elevateNodesOnSelect?: boolean | undefined;
    /** a selected edge is raised; default false in `"basic"`, true in `"auto"` */
    readonly elevateEdgesOnSelect?: boolean | undefined;
}

/**
 * A flow's geometry from its document alone (frozen plain data, keyed by id), as the engine's reads
 * give it before anything is measured.
 */
export interface StaticGeometry {
    /** every node's box in absolute flow coordinates, its size 0 when unknown (`node-rect-by`) */
    readonly nodeRects: Readonly<Record<string, Rect>>;
    /** every node's structural `z-index` (`node-z-index-by`) */
    readonly nodeZIndexes: Readonly<Record<string, number>>;
    /** the path of each edge whose two nodes have a known size (`edge-path-by`); others are absent */
    readonly edgePaths: Readonly<Record<string, EdgePath>>;
    /** the ids of the edges to draw, in drawing order (`drawn-edges`, without `onlyRenderVisible`) */
    readonly drawnEdges: readonly string[];
    /** the levels to draw (`render-layers`) */
    readonly layers: readonly RenderLayer[];
}

/**
 * The geometry of a flow's document without an engine: what an adapter renders on the server and
 * in its first client render, before the engine measures anything.
 */
export function staticGeometry<T extends FlowTypes = AnyTypes>(
    flow: {
        readonly nodes: readonly FlowNode<T>[];
        readonly edges: readonly FlowEdge<T>[];
    },
    options: StaticGeometryOptions = {},
): StaticGeometry {
    const nodes = flow.nodes as readonly FlowNode[];
    const edges = flow.edges as readonly FlowEdge[];
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const nodeById = (nodeId: string) => byId.get(nodeId);
    const layout: NodeLayout = {
        node: nodeById,
        size: (node) => nodeSize(node),
        nodeOrigin: options.nodeOrigin,
    };
    const rects = new Map<string, Rect>();
    for (const node of nodes) {
        rects.set(node.id, Object.freeze(nodeRectOf(node, layout)));
    }
    const knownRect = (nodeId: string) => {
        const node = byId.get(nodeId);
        return node && nodeSize(node) ? rects.get(nodeId) : undefined;
    };
    const paths = new Map<string, EdgePath>();
    for (const edge of edges) {
        const ends = edgeEnds(edge, {
            rect: knownRect,
            handle: (nodeId, type, handleId) => {
                const node = byId.get(nodeId);
                const rect = rects.get(nodeId);
                return node && rect
                    ? declaredHandleOf(node, rect, type, handleId)
                    : undefined;
            },
            side: (nodeId, type) => {
                const node = byId.get(nodeId);
                return type === "source"
                    ? node?.sourcePosition
                    : node?.targetPosition;
            },
        });
        if (ends) {
            paths.set(
                edge.id,
                Object.freeze(
                    pathOf(edge.type, ends, {
                        ...options.pathOptions,
                        ...edge.pathOptions,
                    }),
                ),
            );
        }
    }
    const shownNodes = nodes.filter((node) => node.hidden !== true);
    const shown = (nodeId: string) => byId.get(nodeId)?.hidden !== true;
    const drawn = drawingOrder(
        edges.filter(
            (edge) =>
                edge.hidden !== true &&
                shown(edge.source) &&
                shown(edge.target) &&
                paths.has(edge.id),
        ),
        (edge) => edgeStackValue(edge, nodeById, options),
    );
    const values = new Map(
        nodes.map((node) => [node.id, nodeStackValue(node, nodeById, options)]),
    );
    const layering = renderLayers(
        shownNodes.map((node) => ({
            id: node.id,
            value: values.get(node.id) ?? 0,
        })),
        drawn.map((edge) => ({
            id: edge.id,
            value: edgeStackValue(edge, nodeById, options),
        })),
        options.zIndexMode ?? "auto",
    );
    return Object.freeze({
        nodeRects: Object.freeze(Object.fromEntries(rects)),
        nodeZIndexes: Object.freeze(
            Object.fromEntries(
                nodes.map((node) => [
                    node.id,
                    layering.zIndexes?.get(node.id) ?? values.get(node.id) ?? 0,
                ]),
            ),
        ),
        edgePaths: Object.freeze(Object.fromEntries(paths)),
        drawnEdges: Object.freeze(drawn.map((edge) => edge.id)),
        layers: layering.layers,
    });
}
