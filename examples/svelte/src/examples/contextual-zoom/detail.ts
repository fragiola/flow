// The contextual-zoom example's thresholds, free of any framework: which detail level a node shows
// at a zoom, and from which zoom the edges' labels show. A level holds from its threshold up to the
// next one's; the zoom buttons step by 1.2, so each level spans a few presses.

/** The detail levels, from the least to the most. */
export const DETAILS = ["low", "medium", "high"] as const;

/** A node's detail level. */
export type Detail = (typeof DETAILS)[number];

/** The zoom from which each level shows (`low` from any zoom). */
export const DETAIL_ZOOM = {
    medium: 0.75,
    high: 1.35,
} as const satisfies Record<Exclude<Detail, "low">, number>;

/** The zoom from which the edges' labels show. */
export const LABEL_ZOOM = 1;

/** The detail level at a zoom: `high` from 1.35, `medium` from 0.75, `low` below. */
export function detailOf(zoom: number): Detail {
    if (zoom >= DETAIL_ZOOM.high) return "high";
    if (zoom >= DETAIL_ZOOM.medium) return "medium";
    return "low";
}

/** Whether the edges' labels show at a zoom (from 1). */
export function showsLabels(zoom: number): boolean {
    return zoom >= LABEL_ZOOM;
}

/** Whether a level shows at least as much as another. */
export function atLeast(detail: Detail, least: Detail): boolean {
    return DETAILS.indexOf(detail) >= DETAILS.indexOf(least);
}
