import {
    computed,
    Directive,
    effect,
    inject,
    input,
    output,
    type Signal,
    untracked,
} from "@angular/core";
import {
    type FlowEngineEventOf,
    type MinimapView,
    partAttributes,
} from "@fragiola/flow";
import {
    ɵbindAttributes as bindAttributes,
    ɵbindStructuralStyle as bindStructuralStyle,
    ɵdefaultContent as defaultContent,
    ɵflowValue as flowValue,
    ɵinjectFlowContext as injectFlowContext,
    ɵinjectHost as injectHost,
    ɵonDestroy as onDestroy,
    ɵoptionalBoolean as optionalBoolean,
    ɵoptionalNumber as optionalNumber,
    ɵpx as px,
} from "@fragiola/flow-angular";
import { FLOW_MINIMAP_VIEW } from "./mini-map-context";
import { bindMiniMapMask } from "./mini-map-mask.directive";

export interface MiniMapState {
    /** what it draws: the nodes, the view and the mask, in flow coordinates */
    readonly view: MinimapView;
}

const SVG = "http://www.w3.org/2000/svg";

const EMPTY_VIEW: MinimapView = Object.freeze({
    viewBox: Object.freeze({ x: 0, y: 0, width: 0, height: 0 }),
    viewBoxAttribute: "0 0 0 0",
    scale: 1,
    nodes: Object.freeze([]),
    view: Object.freeze({ x: 0, y: 0, width: 0, height: 0 }),
    maskPath: "",
});

/** Two minimap views that draw the same. */
function sameView(a: MinimapView, b: MinimapView): boolean {
    return (
        a === b ||
        (a.viewBoxAttribute === b.viewBoxAttribute &&
            a.maskPath === b.maskPath &&
            a.nodes.length === b.nodes.length &&
            a.nodes.every((node, i) => {
                const other = b.nodes[i];
                return (
                    other !== undefined &&
                    node.nodeId === other.nodeId &&
                    node.x === other.x &&
                    node.y === other.y &&
                    node.width === other.width &&
                    node.height === other.height
                );
            }))
    );
}

/**
 * A small map of the flow (`data-flow-part="minimap"`, `minimap()`), on the app's
 * `<svg flowMiniMap>` inside `[flowRoot]`, outside `[flowViewport]`: `width` × `height` pixels
 * showing every node and what the root shows. With `minimap()`'s options, a drag on it pans and
 * its wheel zooms the flow. It draws what the app writes inside it in flow coordinates
 * (`[flowMiniMapNode]`s over `#map="flowMiniMap"`'s `map.state().view.nodes`, a
 * `[flowMiniMapMask]`), or, when the app writes no element, a node per node and the mask. Place
 * it with your style.
 */
@Directive({
    selector: "[flowMiniMap]",
    exportAs: "flowMiniMap",
    providers: [
        {
            provide: FLOW_MINIMAP_VIEW,
            useFactory: (): Signal<MinimapView> =>
                inject(FlowMiniMapDirective).view,
        },
    ],
})
export class FlowMiniMapDirective {
    /** its width, in pixels; default 200 */
    readonly width = input(200, {
        transform: (value: unknown) => optionalNumber(value) ?? 200,
    });
    /** its height, in pixels; default 150 */
    readonly height = input(150, {
        transform: (value: unknown) => optionalNumber(value) ?? 150,
    });
    /**
     * a drag on it moves the view the other way (as grabbing the flow), and a press does not
     * centre the view; default `minimap()`'s `inversePan`
     */
    readonly inversePan = input(undefined, { transform: optionalBoolean });
    /** how fast its wheel zooms: 10 is the flow's own wheel, 20 twice as fast; default `minimap()`'s `zoomStep` */
    readonly zoomStep = input(undefined, { transform: optionalNumber });
    /**
     * a tap on it (the engine's `minimap-click`: `point`, the flow point under the pointer on the
     * minimap, `client` and the DOM `event`): center the view there, add a node there. The root
     * captures the pointer, so a DOM `(click)` never follows a press on it
     */
    readonly minimapClick = output<FlowEngineEventOf<"minimap-click">>();

    private readonly context = injectFlowContext("[flowMiniMap]");

    /** @internal what its nodes and its mask read */
    readonly view: Signal<MinimapView> = flowValue(
        this.context,
        () =>
            this.context.engine()?.get("minimap-view", {
                width: this.width(),
                height: this.height(),
            }) ?? EMPTY_VIEW,
        sameView,
    );

    /** what it draws (`#map="flowMiniMap"`, then `map.state().view.nodes`) */
    readonly state: Signal<MiniMapState> = computed(() => ({
        view: this.view(),
    }));

    constructor() {
        const host = injectHost<SVGSVGElement>();
        const attributes = flowValue(this.context, () => {
            const engine = this.context.engine();
            return engine
                ? engine.adapter.attributes("minimap")
                : partAttributes("minimap");
        });
        bindAttributes(host, () => ({
            ...attributes(),
            viewBox: this.view().viewBoxAttribute,
            width: String(this.width()),
            height: String(this.height()),
        }));
        bindStructuralStyle(host, () => ({
            width: px(this.width()),
            height: px(this.height()),
        }));
        // its options over `minimap()`'s, one set for the root's minimaps (the engine's part options)
        effect((onCleanup) => {
            const engine = this.context.engine();
            if (!engine) return;
            const options = Object.fromEntries(
                Object.entries({
                    inversePan: this.inversePan(),
                    zoomStep: this.zoomStep(),
                }).filter(([, value]) => value !== undefined),
            );
            untracked(() =>
                engine.adapter.setPartOptions("minimap", "", options),
            );
            onCleanup(() => engine.adapter.setPartOptions("minimap", "", null));
        });
        // its taps (`minimap-click` on its own element: the root may draw several minimaps)
        effect((onCleanup) => {
            const engine = this.context.engine();
            if (!engine) return;
            const stop = untracked(() =>
                engine.subscribe((event) => {
                    if (
                        event.type === "minimap-click" &&
                        event.element === host
                    ) {
                        this.minimapClick.emit(event);
                    }
                }),
            );
            onCleanup(stop);
        });
        // React's default children: a node per node, then the mask
        defaultContent(host, (document) => {
            const mask = document.createElementNS(SVG, "path");
            bindMiniMapMask(mask, this.view);
            const rects = new Map<
                string,
                { rect: SVGRectElement; names: Set<string> }
            >();
            effect(() => {
                const nodes = this.view().nodes;
                this.context.revision();
                const engine = this.context.engine();
                untracked(() => {
                    const ids = new Set(nodes.map((node) => node.nodeId));
                    for (const [id, { rect }] of rects) {
                        if (ids.has(id)) continue;
                        rect.remove();
                        rects.delete(id);
                    }
                    for (const node of nodes) {
                        let entry = rects.get(node.nodeId);
                        if (!entry) {
                            entry = {
                                rect: document.createElementNS(SVG, "rect"),
                                names: new Set(),
                            };
                            rects.set(node.nodeId, entry);
                        }
                        const next: Record<string, string | undefined> = {
                            ...(engine
                                ? engine.adapter.attributes("minimap-node", {
                                      nodeId: node.nodeId,
                                  })
                                : partAttributes("minimap-node", node.nodeId)),
                            x: String(node.x),
                            y: String(node.y),
                            width: String(node.width),
                            height: String(node.height),
                        };
                        for (const name of entry.names) {
                            if (next[name] === undefined) {
                                entry.rect.removeAttribute(name);
                                entry.names.delete(name);
                            }
                        }
                        for (const [name, value] of Object.entries(next)) {
                            if (value === undefined) continue;
                            entry.rect.setAttribute(name, value);
                            entry.names.add(name);
                        }
                    }
                    // in the view's order, before the mask: only a rect out of place moves
                    let next: Element = mask;
                    for (let i = nodes.length - 1; i >= 0; i--) {
                        const rect = rects.get(nodes[i]?.nodeId ?? "")?.rect;
                        if (!rect) continue;
                        if (rect.nextSibling !== next) next.before(rect);
                        next = rect;
                    }
                });
            });
            onDestroy(() => {
                for (const { rect } of rects.values()) rect.remove();
            });
            return [mask];
        });
    }
}
