// The minimap feature's engine side: the geometry a minimap of a given size draws
// (`minimap-view`: the nodes, what the root shows, and the mask around it, in a view box fitted to
// the minimap's aspect), a press or a drag on it that centres the view on the pressed point
// (`pannable`), and the wheel over it that zooms the flow around the root's centre (`zoomable`).
import type { FlowNode } from "../document/types";
import type { MinimapView } from "../engine/verbs";
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

function rectPath(rect: Rect): string {
    const f = formatNumber;
    return `M${f(rect.x)},${f(rect.y)} h${f(rect.width)} v${f(rect.height)} h${f(-rect.width)} z`;
}

/** The minimap's geometry for one size (in pixels). */
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
    const bounds = boundsOf([...nodes, view]) ?? view;
    const room = { width: Math.max(1, width), height: Math.max(1, height) };
    // flow units per pixel: the larger of the two, so the bounds fit both ways
    const fit =
        Math.max(bounds.width / room.width, bounds.height / room.height) || 1;
    const outer = padding * fit;
    const viewBox = {
        x: bounds.x + bounds.width / 2 - (room.width * fit) / 2 - outer,
        y: bounds.y + bounds.height / 2 - (room.height * fit) / 2 - outer,
        width: room.width * fit + 2 * outer,
        height: room.height * fit + 2 * outer,
    };
    const f = formatNumber;
    return {
        viewBox,
        viewBoxAttribute: `${f(viewBox.x)} ${f(viewBox.y)} ${f(viewBox.width)} ${f(viewBox.height)}`,
        scale: viewBox.width / room.width,
        nodes,
        view,
        maskPath: `${rectPath(viewBox)} ${rectPath(view)}`,
    };
}

/** The engine side of `minimap()`. */
export function minimapEngine(
    host: FeatureEngineHost,
    options: MinimapOptions,
): FeatureEngine {
    return {
        get: {
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
            const centre = (clientX: number, clientY: number) => {
                const point = {
                    x:
                        viewBox.x +
                        ((clientX - box.left) / box.width) * viewBox.width,
                    y:
                        viewBox.y +
                        ((clientY - box.top) / box.height) * viewBox.height,
                };
                const viewport = host.viewport();
                host.setViewport(
                    centeredOn(point, viewport.zoom, host.rootSize()),
                );
            };
            centre(event.clientX, event.clientY);
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
            const zoom = viewport.zoom * 2 ** (-event.deltaY * scale * 0.002);
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
