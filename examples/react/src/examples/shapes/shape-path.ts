// The outline of each flowchart shape as one SVG path, drawn inside a node's box (`width` ×
// `height`, in flow units) and kept `inset` from its edges so the stroke is not clipped. Framework
// free: the same paths in every app.

/** The shapes a node can take, in the picker's order. */
export const SHAPES = [
    "rectangle",
    "rounded",
    "diamond",
    "circle",
    "hexagon",
    "parallelogram",
    "cylinder",
] as const;

export type Shape = (typeof SHAPES)[number];

/** Each shape's name, for the picker's buttons. */
export const SHAPE_NAMES: Record<Shape, string> = {
    rectangle: "Rectangle",
    rounded: "Rounded rectangle",
    diamond: "Diamond",
    circle: "Circle",
    hexagon: "Hexagon",
    parallelogram: "Parallelogram",
    cylinder: "Cylinder",
};

/** Whether `value` is one of the shapes. */
export function isShape(value: unknown): value is Shape {
    return (SHAPES as readonly unknown[]).includes(value);
}

/** A number for a path: two decimals at most, no `-0`. */
function n(value: number): string {
    const rounded = Math.round(value * 100) / 100;
    return String(rounded === 0 ? 0 : rounded);
}

/** A closed polygon through `points`. */
function polygon(points: readonly (readonly [number, number])[]): string {
    return `${points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${n(x)} ${n(y)}`).join(" ")} Z`;
}

/**
 * The path of `shape` in a `width` × `height` box, `inset` from each side (half the stroke's
 * width). A box smaller than twice the inset draws nothing but a point.
 */
export function shapePath(
    shape: Shape,
    width: number,
    height: number,
    inset = 1,
): string {
    const left = inset;
    const top = inset;
    const right = Math.max(inset, width - inset);
    const bottom = Math.max(inset, height - inset);
    const w = right - left;
    const h = bottom - top;
    const cx = left + w / 2;
    const cy = top + h / 2;
    switch (shape) {
        case "rectangle":
            return polygon([
                [left, top],
                [right, top],
                [right, bottom],
                [left, bottom],
            ]);
        case "rounded": {
            const r = Math.min(12, w / 4, h / 4);
            return [
                `M${n(left + r)} ${n(top)}`,
                `H${n(right - r)}`,
                `A${n(r)} ${n(r)} 0 0 1 ${n(right)} ${n(top + r)}`,
                `V${n(bottom - r)}`,
                `A${n(r)} ${n(r)} 0 0 1 ${n(right - r)} ${n(bottom)}`,
                `H${n(left + r)}`,
                `A${n(r)} ${n(r)} 0 0 1 ${n(left)} ${n(bottom - r)}`,
                `V${n(top + r)}`,
                `A${n(r)} ${n(r)} 0 0 1 ${n(left + r)} ${n(top)}`,
                "Z",
            ].join(" ");
        }
        case "diamond":
            return polygon([
                [cx, top],
                [right, cy],
                [cx, bottom],
                [left, cy],
            ]);
        case "circle": {
            // an ellipse when the box is not square: two half arcs
            const rx = w / 2;
            const ry = h / 2;
            return `M${n(left)} ${n(cy)} A${n(rx)} ${n(ry)} 0 1 0 ${n(right)} ${n(cy)} A${n(rx)} ${n(ry)} 0 1 0 ${n(left)} ${n(cy)} Z`;
        }
        case "hexagon": {
            const d = Math.min(w / 4, h / 2);
            return polygon([
                [left + d, top],
                [right - d, top],
                [right, cy],
                [right - d, bottom],
                [left + d, bottom],
                [left, cy],
            ]);
        }
        case "parallelogram": {
            const d = Math.min(w / 4, h / 2);
            return polygon([
                [left + d, top],
                [right, top],
                [right - d, bottom],
                [left, bottom],
            ]);
        }
        case "cylinder": {
            // the body with its top and bottom ellipses, then the top's front rim
            const rx = w / 2;
            const ry = Math.min(12, h / 6);
            return [
                `M${n(left)} ${n(top + ry)}`,
                `A${n(rx)} ${n(ry)} 0 0 1 ${n(right)} ${n(top + ry)}`,
                `V${n(bottom - ry)}`,
                `A${n(rx)} ${n(ry)} 0 0 1 ${n(left)} ${n(bottom - ry)}`,
                "Z",
                `M${n(left)} ${n(top + ry)}`,
                `A${n(rx)} ${n(ry)} 0 0 0 ${n(right)} ${n(top + ry)}`,
            ].join(" ");
        }
    }
}
