import { computed, Directive, input, type Signal } from "@angular/core";
import type {
    HandleSide,
    NodeToolbarPosition,
    PartAttributes,
} from "@fragiola/flow";
import { injectFlowContext, injectNodeContext } from "../context";
import { flowValue, partOwnerId } from "../inject/internal";
import {
    beforeInputs,
    bindAttributes,
    bindStructuralStyle,
    injectHost,
    optionalBoolean,
    optionalNumber,
} from "../utils/helpers";
import { bindPresence } from "../utils/presence";

export interface NodeToolbarState {
    /** its node (undefined for several nodes' toolbar) */
    readonly nodeId: string | undefined;
    /** the nodes it stands beside: `nodeIds`, or its one node */
    readonly nodeIds: readonly string[];
    /** where it is anchored, in pixels relative to the root */
    readonly position: NodeToolbarPosition;
    readonly side: HandleSide;
}

interface ToolbarView {
    position: NodeToolbarPosition;
    nodeId: string | undefined;
    nodeIds: readonly string[];
    attributes: PartAttributes;
}

/**
 * A toolbar next to a node (`data-flow-part="toolbar"`), on the app's element inside `[flowNode]`:
 * `<div flowNodeToolbar>`, or anywhere in `[flowRoot]` beside several nodes' bounds
 * (`[nodeIds]`), moved into `[flowRoot]` (outside the zoom) at the anchor `node-toolbar-by` gives,
 * so it keeps its size at any zoom. It is in the document only while it is shown (`open`; by
 * default while its node, or every node of `nodeIds`, is selected). Presses and the wheel over it are left
 * to it. It holds only what the app writes (its buttons).
 */
@Directive({ selector: "[flowNodeToolbar]", exportAs: "flowNodeToolbar" })
export class FlowNodeToolbarDirective {
    /** its node; default the enclosing `[flowNode]`'s */
    readonly nodeId = input<string | undefined>(undefined);
    /**
     * several nodes it stands beside (their bounds), instead of one; when not empty it wins over
     * `nodeId`, and the toolbar is shown by default while every one of them is selected
     */
    readonly nodeIds = input<readonly string[] | undefined>(undefined);
    /** the node's side it stands on; default `"top"` */
    readonly side = input<HandleSide | undefined>(undefined);
    /** where along that side; default `"center"` */
    readonly align = input<"start" | "center" | "end" | undefined>(undefined);
    /** the gap between the node and the toolbar, in pixels; default 10 */
    readonly offset = input(undefined, { transform: optionalNumber });
    /** whether it is shown; default while its node (every node of `nodeIds`) is selected (`selection()`) */
    readonly open = input(undefined, { transform: optionalBoolean });

    private readonly context = injectFlowContext("[flowNodeToolbar]");
    // several nodes (`nodeIds` not empty), or one: the given one or the enclosing node's
    private readonly many = computed(
        () => (beforeInputs(undefined, this.nodeIds)?.length ?? 0) > 0,
    );
    private readonly id = partOwnerId(
        "[flowNodeToolbar]",
        this.nodeId,
        injectNodeContext(),
        "node",
        () => !this.many(),
    );
    private readonly view = flowValue(
        this.context,
        (): ToolbarView | undefined => {
            const engine = this.context.engine();
            const many = this.many();
            const nodeId = many ? undefined : this.id();
            if (!engine || (!many && nodeId === undefined)) return undefined;
            const nodeIds =
                nodeId === undefined ? [...(this.nodeIds() ?? [])] : [nodeId];
            // hidden, it reads nothing of the view: a pan or a zoom gives the same value (nothing
            // is checked again); shown, an equal anchor keeps the last value
            const model = this.context.model();
            const shown =
                this.open() ??
                nodeIds.every((id) =>
                    model.is("node-selected", { nodeId: id }),
                );
            if (!shown) return undefined;
            const position = engine.get("node-toolbar-by", {
                ...(nodeId === undefined ? { nodeIds } : { nodeId }),
                side: this.side() ?? "top",
                align: this.align(),
                offset: this.offset(),
            });
            return position
                ? {
                      position,
                      nodeId,
                      nodeIds,
                      attributes: engine.adapter.attributes(
                          "toolbar",
                          nodeId === undefined ? {} : { nodeId },
                      ),
                  }
                : undefined;
        },
    );

    /** the toolbar's state (`null` while it is not shown) */
    readonly state: Signal<NodeToolbarState | null> = computed(() => {
        const view = this.view();
        if (!view) return null;
        return {
            nodeId: view.nodeId,
            nodeIds: view.nodeIds,
            position: view.position,
            side: this.side() ?? "top",
        };
    });

    constructor() {
        const host = injectHost();
        bindAttributes(host, () => this.view()?.attributes ?? {});
        bindStructuralStyle(host, () => {
            const position = this.view()?.position;
            return {
                position: "absolute",
                top: 0,
                left: 0,
                transform: position
                    ? `translate(${position.x}px, ${position.y}px) translate(${-position.anchorX * 100}%, ${-position.anchorY * 100}%)`
                    : undefined,
            };
        });
        bindPresence(host, () =>
            this.state() ? this.context.rootElement : null,
        );
    }
}
