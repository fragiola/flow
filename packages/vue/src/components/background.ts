import {
    type BackgroundPattern,
    type BackgroundVariant,
    partAttributes,
} from "@fragiola/flow";
import { h, useId } from "vue";
import { useFlowValue } from "../composables/internal";
import { useFlowContext } from "../context";
import {
    definePrimitive,
    type FlowComponent,
    type PrimitiveProps,
} from "../utils/primitive";
import { type RenderSlot, renderElement } from "../utils/render";

export interface BackgroundState {
    /** the pattern's tile on the screen, at the current viewport */
    readonly pattern: BackgroundPattern;
}

export interface BackgroundProps extends PrimitiveProps {
    /** the marks: `dots` (default), `lines` or `cross` */
    variant?: BackgroundVariant | undefined;
    /** the distance between two marks, in flow units; default 20 (`[x, y]` for two) */
    gap?: number | readonly [number, number] | undefined;
    /** dots: a dot's diameter (flow units); lines: the stroke width (screen pixels); cross: a bar's length */
    size?: number | undefined;
    /** the pattern's shift from the flow's origin, in flow units */
    offset?: number | readonly [number, number] | undefined;
}

export interface BackgroundSlots extends RenderSlot<BackgroundState> {}

const BACKGROUND_STYLE = {
    position: "absolute",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    pointerEvents: "none",
};

const EMPTY_PATTERN: BackgroundPattern = Object.freeze({
    variant: "dots",
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    dot: undefined,
    path: undefined,
    strokeWidth: 0,
});

/** A pair given as a reactive array, as the engine takes it (a plain one). */
function plainPair(
    value: number | readonly [number, number] | undefined,
): number | readonly [number, number] | undefined {
    return Array.isArray(value)
        ? ([value[0], value[1]] as readonly [number, number])
        : value;
}

/**
 * The flow's background (`data-flow-part="background"`): an SVG pattern of dots, lines or crosses
 * that pans and zooms with the viewport (`background-pattern`), inside `Flow.Root` before
 * `Flow.Viewport`. The marks are drawn in `currentColor`: set the `color` (and the background
 * itself) in your style.
 */
export const Background: FlowComponent<BackgroundProps, BackgroundSlots> =
    definePrimitive<BackgroundProps, BackgroundSlots>(
        "Background",
        ["variant", "gap", "size", "offset", "as"],
        (props, { attrs, slots }) => {
            const context = useFlowContext("Background");
            const pattern = useFlowValue(context, () =>
                context.engine.value?.get("background-pattern", {
                    variant: props.variant,
                    gap: plainPair(props.gap),
                    size: props.size,
                    offset: plainPair(props.offset),
                }),
            );
            const id = `flow-background-${(useId() ?? "").replace(/[^a-zA-Z0-9_-]/g, "")}`;
            return () => {
                // drawn once the engine is there (a server render has the bare element)
                const tile = pattern.value;
                return renderElement({
                    tag: "svg",
                    as: props.as,
                    attrs,
                    render: slots.render,
                    state: { pattern: tile ?? EMPTY_PATTERN },
                    props: { ...partAttributes("background") },
                    style: BACKGROUND_STYLE,
                    children: tile
                        ? () => [
                              h(
                                  "pattern",
                                  {
                                      "data-flow-part": "background-pattern",
                                      id,
                                      patternUnits: "userSpaceOnUse",
                                      x: tile.x,
                                      y: tile.y,
                                      width: tile.width,
                                      height: tile.height,
                                  },
                                  [
                                      tile.dot
                                          ? h("circle", {
                                                "data-flow-part":
                                                    "background-mark",
                                                cx: tile.dot.cx,
                                                cy: tile.dot.cy,
                                                r: tile.dot.r,
                                                fill: "currentColor",
                                            })
                                          : h("path", {
                                                "data-flow-part":
                                                    "background-mark",
                                                d: tile.path,
                                                fill: "none",
                                                stroke: "currentColor",
                                                "stroke-width":
                                                    tile.strokeWidth,
                                            }),
                                  ],
                              ),
                              h("rect", {
                                  "data-flow-part": "background-fill",
                                  width: "100%",
                                  height: "100%",
                                  fill: `url(#${id})`,
                              }),
                          ]
                        : undefined,
                });
            };
        },
    );
