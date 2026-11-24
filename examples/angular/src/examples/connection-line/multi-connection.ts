// The connection-line example's framework-free logic: the custom line's shape (an elbow with
// rounded corners), the other selected nodes a connection also starts from, and the edges a drop
// adds for them. The example draws and runs what these return.

export interface Point {
    readonly x: number;
    readonly y: number;
}

/** An edge as the example compares them: its ends. */
export interface Ends {
    readonly source: string;
    readonly target: string;
    readonly targetHandle?: string | undefined;
}

/** What `edge.add` takes for each extra edge. */
export interface NewEdge {
    readonly id: string;
    readonly source: string;
    readonly target: string;
    readonly targetHandle?: string | undefined;
}

/**
 * An elbow from `from` to `to`: across to the middle, down (or up) to the end's height, across to
 * the end, its two corners rounded by `radius` (less when the elbow is too short for it). A
 * straight line when the ends are level or one above the other.
 */
export function elbowPath(from: Point, to: Point, radius = 12): string {
    const midX = (from.x + to.x) / 2;
    const dy = to.y - from.y;
    const r = Math.min(radius, Math.abs(dy) / 2, Math.abs(midX - from.x));
    if (r <= 0) return `M ${from.x},${from.y} L ${to.x},${to.y}`;
    const down = Math.sign(dy);
    const across = Math.sign(to.x - from.x);
    return [
        `M ${from.x},${from.y}`,
        `H ${midX - across * r}`,
        `Q ${midX},${from.y} ${midX},${from.y + down * r}`,
        `V ${to.y - down * r}`,
        `Q ${midX},${to.y} ${midX + across * r},${to.y}`,
        `H ${to.x}`,
    ].join(" ");
}

/**
 * The other nodes a connection from `fromNodeId` also starts from: the rest of the selection when
 * the node it starts from is selected with others; none when it is not selected.
 */
export function otherSources(
    fromNodeId: string,
    selectedIds: readonly string[],
): string[] {
    if (!selectedIds.includes(fromNodeId)) return [];
    return selectedIds.filter((id) => id !== fromNodeId);
}

/**
 * The edges a drop on `target` adds for `sources`: one per source, but none from the target
 * itself nor one that `edges` has already (same source, target and target handle).
 */
export function edgesToAdd(
    sources: readonly string[],
    target: string,
    targetHandle: string | undefined,
    edges: readonly Ends[],
): NewEdge[] {
    const taken = (source: string) =>
        edges.some(
            (edge) =>
                edge.source === source &&
                edge.target === target &&
                edge.targetHandle === targetHandle,
        );
    return [...new Set(sources)]
        .filter((source) => source !== target && !taken(source))
        .map((source) => ({
            id: `${source}-${target}`,
            source,
            target,
            ...(targetHandle === undefined ? {} : { targetHandle }),
        }));
}

/** A point a line starts from, with the node it starts at. */
export interface Start extends Point {
    readonly id: string;
}

/** Whether two lists of starts are the same (a store's `equal`: no re-render when they are). */
export function sameStarts(a: readonly Start[], b: readonly Start[]): boolean {
    return (
        a.length === b.length &&
        a.every(
            (start, i) =>
                start.id === b[i]?.id &&
                start.x === b[i]?.x &&
                start.y === b[i]?.y,
        )
    );
}
