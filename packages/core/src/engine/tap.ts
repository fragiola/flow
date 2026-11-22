// What a tap is: a press that started no gesture and moved at most this far (in pixels) before its
// release. The engine tells taps by it (the `paneClickDistance` and `nodeClickDistance` options
// change it, on the pane and on anything else); a gesture that must leave a tap to the tap path (a
// handle's connection with click-to-connect) starts only past it.

/** How far (in pixels) a press may move and still be a tap, by default. */
export const TAP_TOLERANCE = 3;
