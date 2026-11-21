// The Background's pattern at the current viewport: one tile of an SVG pattern on the screen,
// its marks on the flow's grid (every `gap` flow units from `offset`), scaled by the zoom.
import { formatNumber } from "../geometry/path-format";
import type { Viewport } from "../geometry/types";
import type { BackgroundPattern, BackgroundPatternPayload } from "./verbs";

function pair(
    value: number | readonly [number, number] | undefined,
    fallback: number,
): [number, number] {
    if (value === undefined) return [fallback, fallback];
    return typeof value === "number" ? [value, value] : [value[0], value[1]];
}

/** `value` modulo `period`, in `[0, period)`. */
function wrap(value: number, period: number): number {
    return period > 0 ? ((value % period) + period) % period : 0;
}

/** The tile of a background pattern (its marks at the tile's centre, the tile shifted to match). */
export function backgroundPattern(
    viewport: Viewport,
    payload: BackgroundPatternPayload,
): BackgroundPattern {
    const variant = payload.variant ?? "dots";
    const [gapX, gapY] = pair(payload.gap, 20);
    const [offsetX, offsetY] = pair(payload.offset, 0);
    const { zoom } = viewport;
    const width = gapX * zoom;
    const height = gapY * zoom;
    const cx = width / 2;
    const cy = height / 2;
    // a mark sits at the tile's centre: the tile starts half a gap before a grid point
    const x = wrap(viewport.x + offsetX * zoom - cx, width);
    const y = wrap(viewport.y + offsetY * zoom - cy, height);
    const f = formatNumber;
    if (variant === "dots") {
        const size = payload.size ?? 1;
        return {
            variant,
            x,
            y,
            width,
            height,
            dot: { cx, cy, r: (size * zoom) / 2 },
            path: undefined,
            strokeWidth: 0,
        };
    }
    if (variant === "lines") {
        return {
            variant,
            x,
            y,
            width,
            height,
            dot: undefined,
            path: `M${f(cx)},0 V${f(height)} M0,${f(cy)} H${f(width)}`,
            strokeWidth: payload.size ?? 1,
        };
    }
    const arm = ((payload.size ?? 6) * zoom) / 2;
    return {
        variant,
        x,
        y,
        width,
        height,
        dot: undefined,
        path: `M${f(cx - arm)},${f(cy)} H${f(cx + arm)} M${f(cx)},${f(cy - arm)} V${f(cy + arm)}`,
        strokeWidth: 1,
    };
}
