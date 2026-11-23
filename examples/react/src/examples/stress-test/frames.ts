// The stress test's frame meter: the time between animation frames (requestAnimationFrame's
// timestamps), kept for the last `size` frames, and their median, so one slow frame does not hide
// the usual ones and the usual ones do not hide a stall for long. Framework-free.

export interface FrameMeter {
    /** a frame began at `time` (milliseconds, the rAF timestamp) */
    readonly tick: (time: number) => void;
    /** the median time between the recent frames, in milliseconds; none before two frames */
    readonly median: () => number | undefined;
    /** the slowest of the recent frames, in milliseconds; none before two frames */
    readonly max: () => number | undefined;
    /** forgets every frame (after a pause: the gap is not a frame) */
    readonly reset: () => void;
}

/** The median of some numbers (the mean of the middle two for an even count); none when empty. */
export function medianOf(values: readonly number[]): number | undefined {
    if (values.length === 0) return undefined;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1
        ? sorted[middle]
        : ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2;
}

/** A meter over the last `size` frame intervals. */
export function frameMeter(size = 60): FrameMeter {
    let last: number | undefined;
    let intervals: number[] = [];
    return {
        tick(time) {
            if (last !== undefined && time > last) {
                intervals.push(time - last);
                if (intervals.length > size) intervals.shift();
            }
            last = time;
        },
        median: () => medianOf(intervals),
        max: () =>
            intervals.length === 0 ? undefined : Math.max(...intervals),
        reset() {
            last = undefined;
            intervals = [];
        },
    };
}

/** A time in milliseconds as the readout shows it: one decimal. */
export function formatMs(value: number | undefined): string {
    return value === undefined ? "–" : value.toFixed(1);
}
