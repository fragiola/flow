import {
    computed,
    Directive,
    effect,
    input,
    type Signal,
    untracked,
} from "@angular/core";
import {
    type BackgroundPattern,
    type BackgroundVariant,
    partAttributes,
} from "@fragiola/flow";
import { injectFlowContext } from "../context";
import { flowValue } from "../inject/internal";
import {
    bindAttributes,
    bindStructuralStyle,
    injectHost,
    onDestroy,
    optionalNumber,
} from "../utils/helpers";

export interface BackgroundState {
    /** the pattern's tile on the screen, at the current viewport */
    readonly pattern: BackgroundPattern;
}

const SVG = "http://www.w3.org/2000/svg";
const ATTRIBUTES = partAttributes("background");

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

let nextId = 0;

/** Sets an element's attributes, as text. */
function set(
    element: Element,
    attributes: Readonly<Record<string, string | number>>,
): void {
    for (const [name, value] of Object.entries(attributes)) {
        const text = String(value);
        if (element.getAttribute(name) !== text)
            element.setAttribute(name, text);
    }
}

/**
 * The flow's background (`data-flow-part="background"`), on the app's `<svg flowBackground>`
 * inside `[flowRoot]`, before `[flowViewport]`: an SVG pattern of dots, lines or crosses that
 * pans and zooms with the viewport (`background-pattern`), drawn by the directive inside it (a
 * `pattern` `background-pattern`, its `background-mark`, a `rect` `background-fill`). The marks are
 * drawn in `currentColor`: set the `color` (and the background itself) in your style.
 */
@Directive({ selector: "[flowBackground]", exportAs: "flowBackground" })
export class FlowBackgroundDirective {
    /** the marks: `dots` (default), `lines` or `cross` */
    readonly variant = input<BackgroundVariant | undefined>(undefined);
    /** the distance between two marks, in flow units; default 20 (`[x, y]` for two) */
    readonly gap = input<number | readonly [number, number] | undefined>(
        undefined,
    );
    /** dots: a dot's diameter (flow units); lines: the stroke width (screen pixels); cross: a bar's length */
    readonly size = input(undefined, { transform: optionalNumber });
    /** the pattern's shift from the flow's origin, in flow units */
    readonly offset = input<number | readonly [number, number] | undefined>(
        undefined,
    );

    private readonly context = injectFlowContext("[flowBackground]");
    private readonly pattern = flowValue(this.context, () =>
        this.context.engine()?.get("background-pattern", {
            variant: this.variant(),
            gap: this.gap(),
            size: this.size(),
            offset: this.offset(),
        }),
    );

    /** what it draws (`#bg="flowBackground"`, then `bg.state().pattern`) */
    readonly state: Signal<BackgroundState> = computed(() => ({
        pattern: this.pattern() ?? EMPTY_PATTERN,
    }));

    constructor() {
        const host = injectHost<SVGSVGElement>();
        bindAttributes(host, () => ATTRIBUTES);
        bindStructuralStyle(host, () => ({
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
        }));
        // the tile, drawn once the engine is there
        const document = host.ownerDocument;
        const id = `flow-background-${nextId++}`;
        const pattern = document.createElementNS(SVG, "pattern");
        set(pattern, {
            "data-flow-part": "background-pattern",
            id,
            patternUnits: "userSpaceOnUse",
        });
        const fill = document.createElementNS(SVG, "rect");
        set(fill, {
            "data-flow-part": "background-fill",
            width: "100%",
            height: "100%",
            fill: `url(#${id})`,
        });
        let mark: SVGElement | undefined;
        effect(() => {
            const tile = this.pattern();
            untracked(() => {
                if (!tile) {
                    pattern.remove();
                    fill.remove();
                    return;
                }
                set(pattern, {
                    x: tile.x,
                    y: tile.y,
                    width: tile.width,
                    height: tile.height,
                });
                const tag = tile.dot ? "circle" : "path";
                if (mark?.tagName !== tag) {
                    mark?.remove();
                    mark = document.createElementNS(SVG, tag);
                    mark.setAttribute("data-flow-part", "background-mark");
                    pattern.append(mark);
                }
                if (tile.dot) {
                    set(mark, {
                        cx: tile.dot.cx,
                        cy: tile.dot.cy,
                        r: tile.dot.r,
                        fill: "currentColor",
                    });
                } else {
                    set(mark, {
                        d: tile.path ?? "",
                        fill: "none",
                        stroke: "currentColor",
                        "stroke-width": tile.strokeWidth,
                    });
                }
                if (!pattern.parentNode) host.append(pattern, fill);
            });
        });
        onDestroy(() => {
            pattern.remove();
            fill.remove();
        });
    }
}
