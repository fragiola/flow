import {
    computed,
    Directive,
    type DoCheck,
    effect,
    Injector,
    inject,
    input,
    runInInjectionContext,
    type Signal,
    TemplateRef,
    untracked,
    ViewContainerRef,
} from "@angular/core";
import {
    type AnyTypes,
    edgesLayerAttributes,
    type FlowEdge,
    type FlowTypes,
    partAttributes,
} from "@fragiola/flow";
import {
    type EdgeLabelLayers,
    FLOW_EDGE_LABEL_LAYER,
    injectFlowContext,
} from "../context";
import { flowValue } from "../inject/internal";
import {
    bindAttributes,
    bindStructuralStyle,
    injectHost,
    onDestroy,
    type StructuralStyle,
} from "../utils/helpers";
import { SlotViews } from "../utils/views";
import type { TypedBy } from "./nodes.directive";

export interface EdgesState {
    /** how many edges are drawn */
    count: number;
}

/** The context of the `flowEdgesItem` template: the edge (`let-edge`). */
export interface EdgesItemContext<T extends FlowTypes = AnyTypes> {
    $implicit: FlowEdge<T>;
    edge: FlowEdge<T>;
}

const SVG = "http://www.w3.org/2000/svg";
const ATTRIBUTES = partAttributes("edges");

const LAYER_STYLE: StructuralStyle = {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    overflow: "visible",
    pointerEvents: "none",
};

/** One render level's elements, with several levels: its wrapper (`edges-layer`) and its SVG. */
interface LevelLayer {
    readonly wrapper: HTMLElement;
    readonly svg: SVGSVGElement;
}

/**
 * The layer of the edges (`data-flow-part="edges"`), on the app's element inside `[flowViewport]`,
 * before `[flowNodes]`: `<div flowEdges>`. It holds an SVG of its own (`data-flow-part="edges"`
 * too) where its `<ng-template flowEdgesItem let-edge>` draws each edge, once both its nodes have
 * a size (before the engine exists, from the document's sizes: the static geometry), in the
 * core's drawing order (`drawn-edges`: by stack value), and it is the HTML layer edge labels go
 * to. When an edge stands above some node (`render-layers` has several levels), each level gets a
 * wrapper (`data-flow-part="edges-layer"`, `data-level`, the level's `z-index`) holding its own
 * SVG and its edges' labels, and the nodes interleave with them; the nodes never move. It lets
 * presses through to the pane; the edges' own parts take them.
 */
@Directive({
    selector: "[flowEdges]",
    exportAs: "flowEdges",
    providers: [
        {
            provide: FLOW_EDGE_LABEL_LAYER,
            // the directive is the labels' layers by its `of` (internal, so out of the published
            // types: an `implements` there would name a member the .d.ts does not have)
            useFactory: (): EdgeLabelLayers => inject(FlowEdgesDirective),
        },
    ],
})
export class FlowEdgesDirective {
    private readonly context = injectFlowContext("[flowEdges]");
    /** @internal the HTML layer: the app's element */
    readonly host = injectHost();
    /** @internal the SVG the edges are drawn in */
    readonly svg: SVGSVGElement = this.host.ownerDocument.createElementNS(
        SVG,
        "svg",
    );

    /** each level's wrapper and SVG, made when first needed (level 0's SVG is {@link svg}) */
    private readonly levels: LevelLayer[] = [];
    private readonly injector = inject(Injector);

    /** @internal the edges it draws now */
    readonly list: Signal<readonly FlowEdge[]> = flowValue(this.context, () => {
        const engine = this.context.engine();
        // the core's drawing order: shown, measured, in view with `onlyRenderVisible`, by z-order
        if (engine) return engine.get("drawn-edges");
        // before the engine: the static geometry's (the edges whose nodes have a declared size)
        const geometry = this.context.geometry();
        if (!geometry) return [];
        const model = this.context.model();
        return geometry.drawnEdges.flatMap((id) => {
            const edge = model.get("edge-by", { id });
            return edge ? [edge] : [];
        });
    });

    /** @internal several render levels: each one in its own wrapper */
    readonly layered = computed(() => this.context.layers().length > 1);

    /** @internal each drawn edge's level, with several levels */
    readonly levelOf = computed((): ReadonlyMap<string, number> => {
        const levels = new Map<string, number>();
        for (const layer of this.context.layers()) {
            for (const id of layer.edgeIds) levels.set(id, layer.level);
        }
        return levels;
    });

    /** what it shows (`#edges="flowEdges"`, then `edges.state().count`) */
    readonly state: Signal<EdgesState> = flowValue(this.context, () => ({
        count: this.list().length,
    }));

    constructor() {
        bindAttributes(this.host, () => ATTRIBUTES);
        bindStructuralStyle(this.host, () => LAYER_STYLE);
        for (const [name, value] of Object.entries(ATTRIBUTES)) {
            if (value !== undefined) this.svg.setAttribute(name, value);
        }
        bindStructuralStyle(this.svg, () => LAYER_STYLE);
        this.host.prepend(this.svg);
        // one level: the SVG in the app's element (the DOM before levels); several: a wrapper each
        effect(() => {
            const count = this.context.layers().length;
            untracked(() => this.arrange(count));
        });
        onDestroy(() => {
            this.svg.remove();
            for (const { wrapper } of this.levels) wrapper.remove();
        });
    }

    /** @internal the SVG a level's edges are drawn in */
    svgOf(level: number): SVGSVGElement {
        return level === 0 ? this.svg : this.level(level).svg;
    }

    /** @internal the HTML layer of an edge's level: where its labels go */
    of(edgeId: string): HTMLElement {
        if (!this.layered()) return this.host;
        const level = this.levelOf().get(edgeId) ?? 0;
        return untracked(() => this.level(level).wrapper);
    }

    /** a level's wrapper and SVG, made once (they stay out of the document while not drawn) */
    private level(level: number): LevelLayer {
        for (let i = this.levels.length; i <= level; i++) {
            untracked(() =>
                runInInjectionContext(this.injector, () =>
                    this.levels.push(this.createLevel(i)),
                ),
            );
        }
        return this.levels[level] as LevelLayer;
    }

    private createLevel(level: number): LevelLayer {
        const document = this.host.ownerDocument;
        const wrapper = document.createElement("div");
        bindAttributes(wrapper, () => {
            const engine = this.context.engine();
            return engine
                ? engine.adapter.attributes("edges-layer", { level })
                : edgesLayerAttributes(level);
        });
        bindStructuralStyle(wrapper, () => ({
            ...LAYER_STYLE,
            zIndex: this.context.layers()[level]?.zIndex,
        }));
        let svg = this.svg;
        if (level > 0) {
            svg = document.createElementNS(SVG, "svg");
            for (const [name, value] of Object.entries(ATTRIBUTES)) {
                if (value !== undefined) svg.setAttribute(name, value);
            }
            bindStructuralStyle(svg, () => LAYER_STYLE);
            wrapper.append(svg);
        }
        return { wrapper, svg };
    }

    /**
     * brings the elements to `count` levels; level 0's SVG moving into or out of its wrapper
     * takes the focus from an edge in it, given back after the move
     */
    private arrange(count: number): void {
        const active = this.host.ownerDocument.activeElement;
        const focused =
            active && active !== this.svg && this.svg.contains(active)
                ? active
                : undefined;
        this.place(count);
        if (focused) this.context.engine()?.adapter.refocus(focused);
    }

    private place(count: number): void {
        if (count <= 1) {
            for (const { wrapper } of this.levels) wrapper.remove();
            if (this.svg.parentNode !== this.host) this.host.prepend(this.svg);
            return;
        }
        const shown = Array.from(
            { length: count },
            (_, level) => this.level(level).wrapper,
        );
        for (const { wrapper } of this.levels.slice(count)) wrapper.remove();
        const first = shown[0] as HTMLElement;
        if (this.svg.parentNode !== first) first.prepend(this.svg);
        const inPlace = shown.every(
            (wrapper, i) => this.host.children[i] === wrapper,
        );
        if (!inPlace) this.host.prepend(...shown);
    }
}

/**
 * Draws one edge, inside `[flowEdges]`: `<ng-template flowEdgesItem let-edge>`, usually a
 * `<svg:g [flowEdge]="edge">` with its path and label (the `svg:` prefix: the template is written
 * in the HTML layer, its views go into the SVG). `[flowEdgesItem]="model"` types the edge by the
 * model's registry. An edge's view is rendered again only when its edge changes; its path follows
 * the engine by itself.
 */
@Directive({ selector: "ng-template[flowEdgesItem]" })
export class FlowEdgesItemDirective<T extends FlowTypes = AnyTypes>
    implements DoCheck
{
    /** what types the template's edge (optional): the model */
    readonly flowEdgesItem = input<TypedBy<T>>(undefined);

    static ngTemplateContextGuard<T extends FlowTypes>(
        _directive: FlowEdgesItemDirective<T>,
        _context: unknown,
    ): _context is EdgesItemContext<T> {
        return true;
    }

    private readonly views: SlotViews<EdgesItemContext<T>>;

    constructor() {
        const edges = inject(FlowEdgesDirective, { optional: true });
        if (!edges) {
            throw new Error("flowEdgesItem must be used inside [flowEdges]");
        }
        // the views go where the template's anchor is: in the SVG (level 0's), and with several
        // render levels before an anchor of their own in each other level's SVG
        const anchor = inject(ViewContainerRef).element
            .nativeElement as Comment;
        edges.svg.append(anchor);
        const anchors: Comment[] = [anchor];
        const anchorOf = (level: number): Comment => {
            let at = anchors[level];
            if (!at) {
                at = anchor.ownerDocument.createComment("");
                edges.svgOf(level).append(at);
                anchors[level] = at;
            }
            return at;
        };
        const views = new SlotViews(
            anchor,
            inject<TemplateRef<EdgesItemContext<T>>>(TemplateRef),
        );
        this.views = views;
        const context = injectFlowContext("flowEdgesItem");
        effect(() => {
            const list = edges.list() as readonly FlowEdge<T>[];
            const layered = edges.layered();
            const levels = edges.levelOf();
            untracked(() =>
                views.sync(
                    list.map((edge) => ({
                        key: edge.id,
                        context: { $implicit: edge, edge },
                        anchor: layered
                            ? anchorOf(levels.get(edge.id) ?? 0)
                            : anchor,
                    })),
                    // an edge moved to another level's SVG gets back the focus the move took
                    (moved) => {
                        const engine = context.engine();
                        for (const element of moved) {
                            engine?.adapter.refocus(element);
                        }
                    },
                ),
            );
        });
        onDestroy(() => {
            views.clear();
            for (const at of anchors) at?.remove();
        });
    }

    /** its views are checked whenever the template it is in is (Angular's embedded views are) */
    ngDoCheck(): void {
        this.views.markForCheck();
    }
}
