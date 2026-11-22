// The minimap feature's engine side: the geometry a minimap of a given size draws
// (`minimap-view`: the nodes, what the root shows, and the mask around it, in a view box fitted to
// the minimap's aspect), a press or a drag on it that centres the view on the pressed point
// (`pannable`), and the wheel over it that zooms the flow around the root's centre (`zoomable`).
import { PART_ATTRIBUTE } from "../attributes/part-attributes";
import type { FlowNode, XY } from "../document/types";
import type { MinimapView } from "../engine/verbs";
import { WHEEL_RATE } from "../engine/wheel-rate";
import type { FeatureEngine, FeatureEngineHost } from "../features/types";
import { formatNumber } from "../geometry/path-format";
import { boundsOf } from "../geometry/rect";
import type { Rect } from "../geometry/types";
import {
    centeredOn,
    clampZoom,
    viewRect,
    zoomAround,
} from "../geometry/viewport-math";
import type { MinimapOptions } from "./minimap";

/** A rectangle as a closed polygon of absolute points. */
function polygonOf(rect: Rect): string {
    const f = formatNumber;
    const left = f(rect.x);
    const top = f(rect.y);
    const right = f(rect.x + rect.width);
    const bottom = f(rect.y + rect.height);
    return `M${left},${top} L${right},${top} L${right},${bottom} L${left},${bottom} Z`;
}

/**
 * The minimap's geometry for one size (in pixels): the flow units a pixel stands for are the
 * fewest that fit the nodes and the view in the minimap less its padding (a share of its size on
 * every side), and the view box is the whole minimap at that scale, centred on them.
 */
export function minimapView(
    host: FeatureEngineHost,
    width: number,
    height: number,
    padding: number,
): MinimapView {
    const { model } = host;
    const nodes = (model.get("all-nodes") as readonly FlowNode[]).flatMap(
        (node) => {
            if (node.hidden === true || !host.measured(node.id)) return [];
            const rect = host.nodeRect(node.id);
            return rect ? [{ nodeId: node.id, ...rect }] : [];
        },
    );
    const size = host.rootSize();
    const view =
        size.width > 0 && size.height > 0
            ? viewRect(host.viewport(), size)
            : { x: 0, y: 0, width: 0, height: 0 };
    const shown = boundsOf([...nodes, view]) ?? view;
    const pixels = { width: Math.max(1, width), height: Math.max(1, height) };
    const inner = Math.max(0.01, 1 - 2 * Math.min(Math.max(padding, 0), 0.49));
    const unitsPerPixel =
        Math.max(
            shown.width / (pixels.width * inner),
            shown.height / (pixels.height * inner),
        ) || 1;
    const center = {
        x: shown.x + shown.width / 2,
        y: shown.y + shown.height / 2,
    };
    const viewBox = {
        x: center.x - (pixels.width * unitsPerPixel) / 2,
        y: center.y - (pixels.height * unitsPerPixel) / 2,
        width: pixels.width * unitsPerPixel,
        height: pixels.height * unitsPerPixel,
    };
    const f = formatNumber;
    return {
        viewBox,
        viewBoxAttribute: `${f(viewBox.x)} ${f(viewBox.y)} ${f(viewBox.width)} ${f(viewBox.height)}`,
        scale: unitsPerPixel,
        nodes,
        view,
        maskPath: `${polygonOf(viewBox)} ${polygonOf(view)}`,
    };
}

/** A client point on a minimap element of `box` as a flow point, through its view box. */
function pointOn(box: DOMRect, viewBox: Rect, client: XY): XY {
    return {
        x: viewBox.x + ((client.x - box.left) / box.width) * viewBox.width,
        y: viewBox.y + ((client.y - box.top) / box.height) * viewBox.height,
    };
}

/** Whether a client point lies in an element's box. */
function contains(box: DOMRect, client: XY): boolean {
    return (
        client.x >= box.left &&
        client.x <= box.left + box.width &&
        client.y >= box.top &&
        client.y <= box.top + box.height
    );
}

/** The engine side of `minimap()`. */
export function minimapEngine(
    host: FeatureEngineHost,
    options: MinimapOptions,
): FeatureEngine {
    let root: Element | undefined;
    return {
        attached: (element) => {
            root = element;
        },
        detached: () => {
            root = undefined;
        },
        get: {
            "minimap-point-to-flow": (payload) => {
                const { client } = (payload ?? {}) as { client?: XY };
                if (
                    !root ||
                    typeof client?.x !== "number" ||
                    typeof client?.y !== "number"
                )
                    return undefined;
                // the minimap under the point (an app may draw several), else the first
                const boxes = [
                    ...root.querySelectorAll(`[${PART_ATTRIBUTE}="minimap"]`),
                ]
                    .map((element) => element.getBoundingClientRect())
                    .filter((box) => box.width > 0 && box.height > 0);
                const box =
                    boxes.find((each) => contains(each, client)) ?? boxes[0];
                if (!box) return undefined;
                const { viewBox } = minimapView(
                    host,
                    box.width,
                    box.height,
                    options.padding,
                );
                return pointOn(box, viewBox, client);
            },
            "minimap-view": (payload) => {
                const { width, height } = payload as {
                    width?: unknown;
                    height?: unknown;
                };
                return minimapView(
                    host,
                    typeof width === "number" ? width : 200,
                    typeof height === "number" ? height : 150,
                    options.padding,
                );
            },
        },
        pointerdown: (event, target) => {
            if (
                target.kind !== "minimap" ||
                !options.pannable ||
                !target.element
            )
                return undefined;
            const box = target.element.getBoundingClientRect();
            if (box.width <= 0 || box.height <= 0) return undefined;
            // the view box at the press: a drag keeps it, though the view it shows moves
            const { viewBox } = minimapView(
                host,
                box.width,
                box.height,
                options.padding,
            );
            const origin = host.viewport();
            const size = host.rootSize();
            const pressed = pointOn(box, viewBox, {
                x: event.clientX,
                y: event.clientY,
            });
            // the view's centre at the press, which an inverse drag moves away from
            const start = {
                x: (size.width / 2 - origin.x) / origin.zoom,
                y: (size.height / 2 - origin.y) / origin.zoom,
            };
            const centre = (clientX: number, clientY: number) => {
                const point = pointOn(box, viewBox, {
                    x: clientX,
                    y: clientY,
                });
                const target = options.inversePan
                    ? {
                          x: start.x - (point.x - pressed.x),
                          y: start.y - (point.y - pressed.y),
                      }
                    : point;
                const viewport = host.viewport();
                host.setViewport(
                    centeredOn(target, viewport.zoom, host.rootSize()),
                );
            };
            // an inverse pan grabs the minimap: the press keeps the view where it is
            if (!options.inversePan) centre(event.clientX, event.clientY);
            let moved = false;
            return {
                move: (moving) => {
                    moved = true;
                    centre(moving.clientX, moving.clientY);
                },
                end: () => {},
                cancel: () => {
                    host.setViewport(origin);
                },
                active: () => moved,
            };
        },
        wheel: (event, target) => {
            if (target.kind !== "minimap") return false;
            // a minimap that does not zoom keeps the wheel from zooming the flow under it
            if (!options.zoomable) return true;
            const viewport = host.viewport();
            const size = host.rootSize();
            const scale = event.deltaMode === 1 ? 16 : 1;
            const zoom =
                viewport.zoom *
                Math.exp(
                    (-event.deltaY * scale * options.zoomStep) /
                        (10 * WHEEL_RATE),
                );
            host.setViewport(
                zoomAround(
                    viewport,
                    clampZoom(
                        zoom,
                        host.zoomLimits().min,
                        host.zoomLimits().max,
                    ),
                    {
                        x: size.width / 2,
                        y: size.height / 2,
                    },
                ),
            );
            return true;
        },
    };
}
