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
    type FlowFeatures,
    type FlowModel,
    type FlowNode,
    type FlowTypes,
    partAttributes,
} from "@fragiola/flow";
import { injectFlowContext } from "../context";
import { flowValue } from "../inject/internal";
import {
    bindAttributes,
    bindStructuralStyle,
    injectHost,
    onDestroy,
} from "../utils/helpers";
import { SlotViews } from "../utils/views";

export interface NodesState {
    /** how many nodes are rendered */
    count: number;
}

/** The context of the `flowNodesItem` template: the node (`let-node`). */
export interface NodesItemContext<T extends FlowTypes = AnyTypes> {
    $implicit: FlowNode<T>;
    node: FlowNode<T>;
}

/** What types a template's entities by a registry: the model (`[flowNodesItem]="model"`), or nothing. */
export type TypedBy<T extends FlowTypes> =
    | FlowModel<T, FlowFeatures>
    | ""
    | null
    | undefined;

const ATTRIBUTES = partAttributes("nodes");

/**
 * The layer of the nodes (`data-flow-part="nodes"`), on the app's element inside `[flowViewport]`:
 * `<div flowNodes>`. Its `<ng-template flowNodesItem let-node>` renders each node that is not
 * hidden (with `onlyRenderVisible`, each one in view, `visible-nodes`), in drawing order, keyed by
 * its id (a node keeps its view and its element when it moves).
 */
@Directive({ selector: "[flowNodes]", exportAs: "flowNodes" })
export class FlowNodesDirective {
    private readonly context = injectFlowContext("[flowNodes]");

    /** @internal the nodes it renders now */
    readonly list: Signal<readonly FlowNode[]> = flowValue(this.context, () => {
        const engine = this.context.engine();
        return engine?.adapter.settings.onlyRenderVisible
            ? engine.get("visible-nodes")
            : this.context
                  .model()
                  .get("all-nodes")
                  .filter((node) => node.hidden !== true);
    });

    /** what it shows (`#nodes="flowNodes"`, then `nodes.state().count`) */
    readonly state: Signal<NodesState> = flowValue(this.context, () => ({
        count: this.list().length,
    }));

    constructor() {
        const host = injectHost();
        bindAttributes(host, () => ATTRIBUTES);
        // its own stacking context with one render level: the nodes' z-index (a selected one
        // raised) orders them among themselves, never above what follows the layer (the
        // connection line). With several, none: their (negative) z-indexes interleave with the
        // edges' level layers in the viewport's stacking context
        bindStructuralStyle(host, () => ({
            position: "absolute",
            top: 0,
            left: 0,
            isolation: this.context.layers().length > 1 ? undefined : "isolate",
        }));
    }
}

/**
 * Renders one node, inside `[flowNodes]`: `<ng-template flowNodesItem let-node>` (or
 * `<div *flowNodesItem="let node" [flowNode]="node">`), usually a `[flowNode]` with its content
 * and handles. `[flowNodesItem]="model"` types the node by the model's registry. A node's view is
 * rendered again only when its node changes (the model shares the nodes it did not change): a drag
 * step renders the moved nodes only. Another template (an `@if` around two) renders every node
 * again with it.
 */
@Directive({ selector: "ng-template[flowNodesItem]" })
export class FlowNodesItemDirective<T extends FlowTypes = AnyTypes>
    implements DoCheck
{
    /** what types the template's node (optional): the model */
    readonly flowNodesItem = input<TypedBy<T>>(undefined);

    static ngTemplateContextGuard<T extends FlowTypes>(
        _directive: FlowNodesItemDirective<T>,
        _context: unknown,
    ): _context is NodesItemContext<T> {
        return true;
    }

    private readonly views: SlotViews<NodesItemContext<T>>;

    constructor() {
        const nodes = inject(FlowNodesDirective, { optional: true });
        if (!nodes) {
            throw new Error("flowNodesItem must be used inside [flowNodes]");
        }
        const anchor = inject(ViewContainerRef).element
            .nativeElement as Comment;
        const views = new SlotViews(
            anchor,
            inject<TemplateRef<NodesItemContext<T>>>(TemplateRef),
        );
        this.views = views;
        effect(() => {
            const list = nodes.list() as readonly FlowNode<T>[];
            views.sync(
                list.map((node) => ({
                    key: node.id,
                    context: { $implicit: node, node },
                })),
            );
        });
        onDestroy(() => views.clear());
    }

    /** its views are checked whenever the template it is in is (Angular's embedded views are) */
    ngDoCheck(): void {
        this.views.markForCheck();
    }
}
