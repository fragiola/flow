// The gradient-styling example's framework-free logic: each kind of step and the two palettes its
// border's gradient runs between, the gradient an edge takes (from its source's colour to its
// target's, so the colour flows through the pipeline), its id inside one flow, and the words that
// name a step.

/** The palettes a gradient may use: the chromatic ones every example theme declares. */
export const TONES = ["blue", "green", "orange", "purple"] as const;
export type Tone = (typeof TONES)[number];

export const KINDS = ["source", "transform", "check", "output"] as const;
export type Kind = (typeof KINDS)[number];

/** A gradient's two ends: the palettes whose accent each end takes. */
export interface Gradient {
    readonly from: Tone;
    readonly to: Tone;
}

/**
 * Each kind's gradient: its border runs from `from` (top left, the kind's own colour) to `to`
 * (bottom right). No two kinds share a colour of their own.
 */
export const KIND_GRADIENTS: Record<Kind, Gradient> = {
    source: { from: "blue", to: "green" },
    transform: { from: "purple", to: "blue" },
    check: { from: "orange", to: "purple" },
    output: { from: "green", to: "orange" },
};

/** An edge's gradient, from its source to its target: each end in that node's own colour. */
export function edgeGradient(source: Kind, target: Kind): Gradient {
    return {
        from: KIND_GRADIENTS[source].from,
        to: KIND_GRADIENTS[target].from,
    };
}

/**
 * A prefix for one flow's gradient ids, from a generated id (React's `useId`): only letters,
 * digits, `-` and `_`, so `url(#…)` needs no escaping and two flows on a page never share one.
 */
export function idPrefix(generated: string): string {
    return `gradient-${generated.replace(/[^A-Za-z0-9_-]/g, "")}`;
}

/** An edge's gradient id inside the flow of `prefix`; the edge id keeps only safe characters. */
export function gradientId(prefix: string, edgeId: string): string {
    return `${prefix}-${edgeId.replace(/[^A-Za-z0-9_-]/g, "_")}`;
}

/** The value of an edge path's `stroke`: its gradient. */
export function gradientUrl(prefix: string, edgeId: string): string {
    return `url(#${gradientId(prefix, edgeId)})`;
}

/** A step's accessible name: "Parse, a transform step: JSON lines to rows". */
export function describeStep(label: string, kind: Kind, detail: string) {
    const article = /^[aeiou]/.test(kind) ? "an" : "a";
    return `${label}, ${article} ${kind} step: ${detail}`;
}
