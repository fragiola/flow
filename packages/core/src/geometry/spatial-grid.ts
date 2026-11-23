// A uniform grid of rectangles by id (Epic #61): each rectangle is filed in the square cells it
// touches, so the rectangles meeting an area are found from that area's cells instead of a scan of
// them all. A rectangle spanning too many cells (a large group, a long edge), or one too far out
// for the cell keys, is kept in a list every query checks. A query whose area covers more cells
// than there are rectangles scans the rectangles instead. Simpler than an R-tree and enough for a
// flow's nodes and edges, which are mostly small and spread out. Pure: no DOM and nothing of the
// engine.
import { overlaps } from "./rect";
import type { Rect } from "./types";

/** The side of a cell, in the rectangles' units, unless one is given. */
export const GRID_CELL = 256;

/** The most cells a rectangle is filed in; a larger one is kept in the list every query checks. */
const MOST_CELLS = 64;
/** Cell coordinates stay within ±2^20, so a cell's key (both coordinates) is an exact number. */
const REACH = 2 ** 20;

interface Entry {
    readonly id: string;
    readonly rect: Rect;
    /** the cells it is filed in (none: it is in the large list) */
    readonly cells: readonly number[] | undefined;
    /** the last query that took it (a rectangle in several cells is taken once) */
    seen: number;
}

/**
 * Rectangles by id, queried by area: `query(area)` gives the ids of those that meet it, touching
 * included (as `overlaps`), in no given order.
 */
export class SpatialGrid {
    private readonly cell: number;
    private readonly entries = new Map<string, Entry>();
    private readonly cells = new Map<number, Set<Entry>>();
    private readonly large = new Set<Entry>();
    private queries = 0;

    constructor(cell: number = GRID_CELL) {
        this.cell = cell > 0 && Number.isFinite(cell) ? cell : GRID_CELL;
    }

    /** How many rectangles it holds. */
    get size(): number {
        return this.entries.size;
    }

    /** Whether it holds a rectangle of this id. */
    has(id: string): boolean {
        return this.entries.has(id);
    }

    /** The rectangle of an id, as it was filed. */
    get(id: string): Rect | undefined {
        return this.entries.get(id)?.rect;
    }

    /** Files (or moves) the rectangle of an id. */
    set(id: string, rect: Rect): void {
        const previous = this.entries.get(id);
        if (
            previous &&
            previous.rect.x === rect.x &&
            previous.rect.y === rect.y &&
            previous.rect.width === rect.width &&
            previous.rect.height === rect.height
        ) {
            return;
        }
        if (previous) this.unfile(previous);
        const cells = this.cellsOf(rect);
        const entry: Entry = { id, rect, cells, seen: 0 };
        this.entries.set(id, entry);
        if (!cells) {
            this.large.add(entry);
            return;
        }
        for (const key of cells) {
            let set = this.cells.get(key);
            if (!set) {
                set = new Set();
                this.cells.set(key, set);
            }
            set.add(entry);
        }
    }

    /** Forgets the rectangle of an id. */
    delete(id: string): void {
        const entry = this.entries.get(id);
        if (!entry) return;
        this.entries.delete(id);
        this.unfile(entry);
    }

    /** Forgets every rectangle. */
    clear(): void {
        this.entries.clear();
        this.cells.clear();
        this.large.clear();
    }

    /** The ids of the rectangles that meet `area` (touching counts), in no given order. */
    query(area: Rect): string[] {
        const found: string[] = [];
        const range = this.rangeOf(area);
        const count = range
            ? (range.x1 - range.x0 + 1) * (range.y1 - range.y0 + 1)
            : Number.POSITIVE_INFINITY;
        if (!range || count > this.entries.size) {
            for (const entry of this.entries.values()) {
                if (overlaps(entry.rect, area)) found.push(entry.id);
            }
            return found;
        }
        const stamp = ++this.queries;
        const take = (entry: Entry) => {
            if (entry.seen === stamp) return;
            entry.seen = stamp;
            if (overlaps(entry.rect, area)) found.push(entry.id);
        };
        for (let x = range.x0; x <= range.x1; x++) {
            for (let y = range.y0; y <= range.y1; y++) {
                const set = this.cells.get(keyOf(x, y));
                if (set) for (const entry of set) take(entry);
            }
        }
        for (const entry of this.large) take(entry);
        return found;
    }

    /** Every id it holds, in filing order. */
    ids(): IterableIterator<string> {
        return this.entries.keys();
    }

    private unfile(entry: Entry): void {
        if (!entry.cells) {
            this.large.delete(entry);
            return;
        }
        for (const key of entry.cells) {
            const set = this.cells.get(key);
            if (!set) continue;
            set.delete(entry);
            if (set.size === 0) this.cells.delete(key);
        }
    }

    /** The cell range of a rectangle; none when it is not finite or out of the keys' reach. */
    private rangeOf(
        rect: Rect,
    ): { x0: number; y0: number; x1: number; y1: number } | undefined {
        const x0 = Math.floor(rect.x / this.cell);
        const y0 = Math.floor(rect.y / this.cell);
        const x1 = Math.floor((rect.x + rect.width) / this.cell);
        const y1 = Math.floor((rect.y + rect.height) / this.cell);
        if (
            !Number.isFinite(x0) ||
            !Number.isFinite(y0) ||
            !Number.isFinite(x1) ||
            !Number.isFinite(y1) ||
            x1 < x0 ||
            y1 < y0 ||
            x0 < -REACH ||
            y0 < -REACH ||
            x1 >= REACH ||
            y1 >= REACH
        ) {
            return undefined;
        }
        return { x0, y0, x1, y1 };
    }

    /** The cells a rectangle is filed in; none when it goes to the large list. */
    private cellsOf(rect: Rect): number[] | undefined {
        const range = this.rangeOf(rect);
        if (!range) return undefined;
        const count = (range.x1 - range.x0 + 1) * (range.y1 - range.y0 + 1);
        if (count > MOST_CELLS) return undefined;
        const cells: number[] = [];
        for (let x = range.x0; x <= range.x1; x++) {
            for (let y = range.y0; y <= range.y1; y++) cells.push(keyOf(x, y));
        }
        return cells;
    }
}

/** A cell's key: both coordinates in one exact number. */
function keyOf(x: number, y: number): number {
    return (x + REACH) * 2 * REACH + (y + REACH);
}
