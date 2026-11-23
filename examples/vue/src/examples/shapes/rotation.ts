// A node's rotation: the angle a pointer makes around the node's centre, and the side a handle
// faces once its node is turned. Framework free: the same maths in every app. Angles are degrees,
// clockwise from straight up (0 points up, 90 right), in [0, 360).

/** The four sides, clockwise from the top. */
const SIDES = ["top", "right", "bottom", "left"] as const;

export type Side = (typeof SIDES)[number];

/** `angle` brought into [0, 360). */
export function normalizeAngle(angle: number): number {
    const turned = ((angle % 360) + 360) % 360;
    return turned === 0 ? 0 : turned;
}

/**
 * The angle of `point` around `center` (screen coordinates, y down), clockwise from straight up,
 * rounded to a multiple of `snap` degrees (1: whole degrees).
 */
export function angleFrom(
    center: { x: number; y: number },
    point: { x: number; y: number },
    snap = 1,
): number {
    const degrees =
        (Math.atan2(point.y - center.y, point.x - center.x) * 180) / Math.PI +
        90;
    const step = snap > 0 ? snap : 1;
    return normalizeAngle(Math.round(degrees / step) * step);
}

/**
 * The side a handle drawn on `side` faces once its node is turned by `angle`: the nearest quarter
 * turn (so its edges leave the way the handle points).
 */
export function rotatedSide(side: Side, angle: number): Side {
    const quarters = Math.round(normalizeAngle(angle) / 90);
    return SIDES[(SIDES.indexOf(side) + quarters) % 4] ?? side;
}
