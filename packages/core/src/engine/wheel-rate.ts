// How fast the wheel zooms: a wheel's `deltaY` pixels zoom by `exp(-deltaY / rate)`, so the same
// scroll always zooms by the same factor whatever the zoom. A trackpad's pinch (a wheel event
// with Ctrl) sends small deltas, so its rate is lower. A wheel has no end of its own: its move ends
// once no wheel event came for a while.

/** The wheel's pixels that zoom by a factor of e. */
export const WHEEL_RATE = 600;

/** A trackpad pinch's pixels that zoom by a factor of e. */
export const WHEEL_PINCH_RATE = 120;

/** How long (in milliseconds) the wheel rests before its move ends (`viewport-change-end`). */
export const WHEEL_REST = 150;
