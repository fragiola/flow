// The edge-markers example's framework-free logic: the shapes a marker can take (drawn in a
// 10 x 10 box, the edge's end at `refX`), the markers a set of edges needs (one per shape and
// tone, and one per shape for the selected state, which takes the selection's colour whatever the
// tone), their ids inside one flow, and the words that name an edge's ends.

export const SHAPES = ["arrow", "open-arrow", "circle", "diamond"] as const;
export type Shape = (typeof SHAPES)[number];

export const TONES = ["neutral", "blue", "green", "orange", "purple"] as const;
export type Tone = (typeof TONES)[number];

/** The state a marker colours: the edge's tone, or the selection's. */
export type MarkerState = Tone | "selected";

/** A marker's drawing: its path in a 10 x 10 box, where the edge ends, filled or outlined. */
export interface ShapeGeometry {
    readonly d: string;
    readonly refX: number;
    readonly filled: boolean;
}

/**
 * Each shape's drawing, pointing along +x: the edge ends at `refX`, so the shape sits on the
 * line's end and never past it. With `orient="auto-start-reverse"` a start marker points back.
 */
export const GEOMETRY: Record<Shape, ShapeGeometry> = {
    arrow: { d: "M 0,0 L 10,5 L 0,10 Z", refX: 10, filled: true },
    "open-arrow": { d: "M 1,1 L 9,5 L 1,9", refX: 9, filled: false },
    circle: {
        d: "M 1,5 A 4,4 0 1 1 9,5 A 4,4 0 1 1 1,5 Z",
        refX: 9,
        filled: false,
    },
    diamond: { d: "M 0,5 L 5,0.5 L 10,5 L 5,9.5 Z", refX: 10, filled: true },
};

/** What an edge says about its ends. */
export interface Ends {
    readonly start?: Shape | undefined;
    readonly end?: Shape | undefined;
    readonly tone: Tone;
}

/** One `<marker>` to define. */
export interface MarkerDef {
    readonly shape: Shape;
    readonly state: MarkerState;
}

/**
 * The markers `edges` need, each once: per shape used, one in each tone that uses it and one for
 * the selected state. Ordered by shape, then the tones' order, the selected one last.
 */
export function markersFor(edges: readonly Ends[]): MarkerDef[] {
    const used = new Set<string>();
    for (const { start, end, tone } of edges) {
        for (const shape of [start, end]) {
            if (!shape) continue;
            used.add(`${shape}:${tone}`);
            used.add(`${shape}:selected`);
        }
    }
    const states: readonly MarkerState[] = [...TONES, "selected"];
    return SHAPES.flatMap((shape) =>
        states
            .filter((state) => used.has(`${shape}:${state}`))
            .map((state) => ({ shape, state })),
    );
}

/**
 * A prefix for one flow's marker ids, from a generated id (React's `useId`): only letters,
 * digits, `-` and `_`, so `url(#…)` needs no escaping and two flows on a page never share one.
 */
export function idPrefix(generated: string): string {
    return `markers-${generated.replace(/[^A-Za-z0-9_-]/g, "")}`;
}

/** A marker's id inside the flow of `prefix`. */
export function markerId(prefix: string, shape: Shape, state: MarkerState) {
    return `${prefix}-${shape}-${state}`;
}

/** The value of `marker-start` / `marker-end` for a marker, or undefined for no shape. */
export function markerUrl(
    prefix: string,
    shape: Shape | undefined,
    state: MarkerState,
): string | undefined {
    return shape ? `url(#${markerId(prefix, shape, state)})` : undefined;
}

const WORDS: Record<Shape, string> = {
    arrow: "an arrow",
    "open-arrow": "an open arrow",
    circle: "a circle",
    diamond: "a diamond",
};

/** The words naming an edge's ends: "a circle at the start, an arrow at the end". */
export function describeEnds({ start, end }: Ends): string {
    const parts = [
        start && `${WORDS[start]} at the start`,
        end && `${WORDS[end]} at the end`,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : "no markers";
}
