import {
    Directive,
    type DoCheck,
    effect,
    inject,
    input,
    type Signal,
    TemplateRef,
    ViewContainerRef,
} from "@angular/core";
import {
    type AnyTypes,
    type FlowEdge,
    type FlowTypes,
    partAttributes,
} from "@fragiola/flow";
import { FLOW_EDGE_LABEL_LAYER, injectFlowContext } from "../context";
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

/**
 * The layer of the edges (`data-flow-part="edges"`), on the app's element inside `[flowViewport]`,
 * before `[flowNodes]`: `<div flowEdges>`. It holds an SVG of its own (`data-flow-part="edges"`
 * too) where its `<ng-template flowEdgesItem let-edge>` draws each edge, once both its nodes have
 * a size (`edge-path-by`), and it is the HTML layer edge labels go to. It lets presses through to
 * the pane; the edges' own parts take them.
 */
@Directive({
    selector: "[flowEdges]",
    exportAs: "flowEdges",
    providers: [
        {
            provide: FLOW_EDGE_LABEL_LAYER,
            useFactory: (): HTMLElement => inject(FlowEdgesDirective).host,
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

    /** @internal the edges it draws now */
    readonly list: Signal<readonly FlowEdge[]> = flowValue(this.context, () => {
        const engine = this.context.engine();
        if (!engine) return [];
        const model = this.context.model();
        const edges = engine.adapter.settings.onlyRenderVisible
            ? engine.get("visible-edges")
            : model
                  .get("all-edges")
                  .filter(
                      (edge) =>
                          edge.hidden !== true &&
                          model.get("node-by", { id: edge.source })?.hidden !==
                              true &&
                          model.get("node-by", { id: edge.target })?.hidden !==
                              true,
                  );
        return edges.filter(
            (edge) =>
                engine.get("edge-path-by", { edgeId: edge.id }) !== undefined,
        );
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
        onDestroy(() => this.svg.remove());
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
        // the views go where the template's anchor is: in the SVG
        const anchor = inject(ViewContainerRef).element
            .nativeElement as Comment;
        edges.svg.append(anchor);
        const views = new SlotViews(
            anchor,
            inject<TemplateRef<EdgesItemContext<T>>>(TemplateRef),
        );
        this.views = views;
        effect(() => {
            const list = edges.list() as readonly FlowEdge<T>[];
            views.sync(
                list.map((edge) => ({
                    key: edge.id,
                    context: { $implicit: edge, edge },
                })),
            );
        });
        onDestroy(() => {
            views.clear();
            anchor.remove();
        });
    }

    /** its views are checked whenever the template it is in is (Angular's embedded views are) */
    ngDoCheck(): void {
        this.views.markForCheck();
    }
}
