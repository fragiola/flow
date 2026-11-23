// A standalone SVG of a flow, built from its document alone: the core's static geometry
// (`staticGeometry`: each node's box from its declared size, each edge's path from the same path
// helpers the engine runs) turned into a string. No DOM, no engine, no dependency, so the very
// same function runs in the browser (the example's Download buttons) and on a server (the unit
// test renders it in node).
//
// A standalone file cannot read the page's CSS variables, so its colours, font and strokes are
// plain values in `SvgLook`: the browser reads them off the drawn flow at click time (the theme's
// resolved tokens), a server passes its own or keeps the neutral defaults below.
import {
    type AnyTypes,
    type FlowEdge,
    type FlowNode,
    type FlowTypes,
    type Rect,
    staticGeometry,
} from "@fragiola/flow-vue";

/** How the SVG looks: plain values, since nothing in a standalone file resolves a CSS variable. */
export interface SvgLook {
    /** the canvas behind the flow; `"none"` leaves it transparent */
    readonly background: string;
    readonly nodeFill: string;
    readonly nodeStroke: string;
    readonly nodeStrokeWidth: number;
    readonly nodeRadius: number;
    readonly text: string;
    readonly fontFamily: string;
    readonly fontSize: number;
    readonly fontWeight: string;
    readonly edgeStroke: string;
    readonly edgeWidth: number;
    /** an edge's `stroke-dasharray`; `"none"` draws it solid */
    readonly edgeDash: string;
}

/** The look of a server-side export that names none: neutral, readable on white. */
export const DEFAULT_LOOK: SvgLook = Object.freeze({
    background: "#ffffff",
    nodeFill: "#ffffff",
    nodeStroke: "#cbd5e1",
    nodeStrokeWidth: 1,
    nodeRadius: 8,
    text: "#0f172a",
    fontFamily: "system-ui, sans-serif",
    fontSize: 14,
    fontWeight: "500",
    edgeStroke: "#94a3b8",
    edgeWidth: 1.5,
    edgeDash: "none",
});

export interface SvgOptions<T extends FlowTypes = AnyTypes> {
    /** the room around the content, in flow units; default 24 */
    readonly padding?: number;
    /** overrides of the default look (the browser passes the theme's) */
    readonly look?: Partial<SvgLook>;
    /** a node's text; default its `data.label` when a string, else its id */
    readonly labelOf?: (node: FlowNode<T>) => string;
}

export interface FlowSvg {
    /** the SVG document, ready to save as a `.svg` file */
    readonly markup: string;
    /** its size in pixels (the content's bounds plus the padding, at zoom 1) */
    readonly width: number;
    readonly height: number;
}

/** Text and attribute values made safe for XML. */
export function escapeXml(value: string): string {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&apos;");
}

/** A number short enough for a file, exact enough for a path. */
const num = (value: number) => String(Math.round(value * 100) / 100);

/** The smallest box around the given ones; an empty box at the origin for none. */
export function boundsOf(rects: readonly Rect[]): Rect {
    if (rects.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
    const left = Math.min(...rects.map((rect) => rect.x));
    const top = Math.min(...rects.map((rect) => rect.y));
    const right = Math.max(...rects.map((rect) => rect.x + rect.width));
    const bottom = Math.max(...rects.map((rect) => rect.y + rect.height));
    return { x: left, y: top, width: right - left, height: bottom - top };
}

/**
 * The points of an absolute path (`M`, `L`, `Q`, `C`, as the path helpers write them) as boxes of
 * no size: a curve stays inside its points, so they bound the line however it turns.
 */
export function pointsOf(d: string): Rect[] {
    const numbers = (d.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []).map(Number);
    const points: Rect[] = [];
    for (let i = 0; i + 1 < numbers.length; i += 2) {
        points.push({
            x: numbers[i] ?? 0,
            y: numbers[i + 1] ?? 0,
            width: 0,
            height: 0,
        });
    }
    return points;
}

function defaultLabel(node: FlowNode): string {
    const label = (node.data as { label?: unknown } | undefined)?.label;
    return typeof label === "string" ? label : node.id;
}

/**
 * The flow as a standalone SVG: a path per drawn edge (in drawing order), then a rectangle and a
 * label per shown node of known size, in a viewBox fitted to the content (the nodes, and the edges
 * where a step edge turns outside them) plus `padding`.
 */
export function flowSvg<T extends FlowTypes = AnyTypes>(
    flow: {
        readonly nodes: readonly FlowNode<T>[];
        readonly edges: readonly FlowEdge<T>[];
    },
    options: SvgOptions<T> = {},
): FlowSvg {
    const look = { ...DEFAULT_LOOK, ...options.look };
    const padding = options.padding ?? 24;
    const labelOf =
        options.labelOf ?? (defaultLabel as (node: FlowNode<T>) => string);
    const geometry = staticGeometry(flow);
    // a node is drawn when shown and of known size (its declared or initial one)
    const drawn = flow.nodes.flatMap((node) => {
        const rect = geometry.nodeRects[node.id];
        return node.hidden !== true && rect && rect.width > 0 && rect.height > 0
            ? [{ node, rect }]
            : [];
    });
    const paths = geometry.drawnEdges.flatMap((edgeId) => {
        const path = geometry.edgePaths[edgeId];
        return path ? [{ edgeId, d: path.path }] : [];
    });
    const bounds = boundsOf([
        ...drawn.map(({ rect }) => rect),
        ...paths.flatMap(({ d }) => pointsOf(d)),
    ]);
    const x = bounds.x - padding;
    const y = bounds.y - padding;
    const width = bounds.width + padding * 2;
    const height = bounds.height + padding * 2;
    const attr = (value: string | number) =>
        escapeXml(typeof value === "number" ? num(value) : value);

    const background =
        look.background === "none"
            ? ""
            : `<rect x="${attr(x)}" y="${attr(y)}" width="${attr(width)}" height="${attr(height)}" fill="${attr(look.background)}"/>`;
    const dash =
        look.edgeDash === "none"
            ? ""
            : ` stroke-dasharray="${attr(look.edgeDash)}"`;
    const edges = paths.map(
        ({ edgeId, d }) => `<path data-id="${attr(edgeId)}" d="${attr(d)}"/>`,
    );
    const shapes = drawn.map(
        ({ node, rect }) =>
            `<rect data-id="${attr(node.id)}" x="${attr(rect.x)}" y="${attr(rect.y)}" width="${attr(rect.width)}" height="${attr(rect.height)}" rx="${attr(look.nodeRadius)}"/>`,
    );
    const labels = drawn.map(
        ({ node, rect }) =>
            `<text data-id="${attr(node.id)}" x="${attr(rect.x + rect.width / 2)}" y="${attr(rect.y + rect.height / 2)}">${escapeXml(labelOf(node))}</text>`,
    );

    // edges first, nodes on top, their labels last; each group carries its look once
    const markup = [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${attr(width)}" height="${attr(height)}" viewBox="${attr(x)} ${attr(y)} ${attr(width)} ${attr(height)}">`,
        background,
        `<g fill="none" stroke="${attr(look.edgeStroke)}" stroke-width="${attr(look.edgeWidth)}"${dash}>`,
        ...edges,
        "</g>",
        `<g fill="${attr(look.nodeFill)}" stroke="${attr(look.nodeStroke)}" stroke-width="${attr(look.nodeStrokeWidth)}">`,
        ...shapes,
        "</g>",
        `<g fill="${attr(look.text)}" font-family="${attr(look.fontFamily)}" font-size="${attr(look.fontSize)}" font-weight="${attr(look.fontWeight)}" text-anchor="middle" dominant-baseline="central">`,
        ...labels,
        "</g>",
        "</svg>",
    ]
        .filter(Boolean)
        .join("\n");
    return { markup, width, height };
}
