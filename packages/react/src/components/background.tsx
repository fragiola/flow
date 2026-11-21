import {
    type BackgroundPattern,
    type BackgroundVariant,
    partAttributes,
} from "@fragiola/flow";
import * as React from "react";
import { useFlowContext } from "../context";
import { useFlowValue } from "../hooks/internal";
import { type SvgPrimitiveProps, useRenderElement } from "../utils/use-render";

export interface BackgroundState {
    /** the pattern's tile on the screen, at the current viewport */
    readonly pattern: BackgroundPattern;
}

export interface BackgroundProps
    extends Omit<
        SvgPrimitiveProps<BackgroundState, SVGSVGElement>,
        "children" | "offset"
    > {
    /** the marks: `dots` (default), `lines` or `cross` */
    variant?: BackgroundVariant | undefined;
    /** the distance between two marks, in flow units; default 20 (`[x, y]` for two) */
    gap?: number | readonly [number, number] | undefined;
    /** a dot's diameter, or a cross's arm length, in flow units */
    size?: number | undefined;
    /** the pattern's shift from the flow's origin, in flow units */
    offset?: number | readonly [number, number] | undefined;
}

const BACKGROUND_STYLE: React.CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    pointerEvents: "none",
};

/**
 * The flow's background (`data-flow-part="background"`): an SVG pattern of dots, lines or crosses
 * that pans and zooms with the viewport (`background-pattern`), inside `Flow.Root` before
 * `Flow.Viewport`. The marks are drawn in `currentColor`: set the `color` (and the background
 * itself) in your style.
 */
export function Background(props: BackgroundProps) {
    const { variant, gap, size, offset, ...rest } = props;
    const { model, engine } = useFlowContext("Background");
    const pattern = useFlowValue(model, engine, () =>
        engine
            ? engine.get("background-pattern", { variant, gap, size, offset })
            : undefined,
    );
    const id = `flow-background-${React.useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
    // drawn once the engine is there (a server render has the bare element)
    const tile = pattern;
    return useRenderElement("svg", rest, {
        state: {
            pattern: tile ?? EMPTY_PATTERN,
        },
        props: {
            ...partAttributes("background"),
            children: tile ? (
                <>
                    <pattern
                        data-flow-part="background-pattern"
                        id={id}
                        patternUnits="userSpaceOnUse"
                        x={tile.x}
                        y={tile.y}
                        width={tile.width}
                        height={tile.height}
                    >
                        {tile.dot ? (
                            <circle
                                data-flow-part="background-mark"
                                cx={tile.dot.cx}
                                cy={tile.dot.cy}
                                r={tile.dot.r}
                                fill="currentColor"
                            />
                        ) : (
                            <path
                                data-flow-part="background-mark"
                                d={tile.path}
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={tile.strokeWidth}
                            />
                        )}
                    </pattern>
                    <rect
                        data-flow-part="background-fill"
                        width="100%"
                        height="100%"
                        fill={`url(#${id})`}
                    />
                </>
            ) : null,
        },
        style: BACKGROUND_STYLE,
    });
}

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
