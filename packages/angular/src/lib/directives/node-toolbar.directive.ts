import { computed, Directive, input, type Signal } from "@angular/core";
import type {
    HandleSide,
    NodeToolbarPosition,
    PartAttributes,
} from "@fragiola/flow";
import { injectFlowContext, injectNodeContext } from "../context";
import { flowValue, partOwnerId } from "../inject/internal";
import {
    bindAttributes,
    bindStructuralStyle,
    injectHost,
    optionalBoolean,
    optionalNumber,
} from "../utils/helpers";
import { bindPresence } from "../utils/presence";

export interface NodeToolbarState {
    readonly nodeId: string;
    /** where it is anchored, in pixels relative to the root */
    readonly position: NodeToolbarPosition;
    readonly side: HandleSide;
}

interface ToolbarView {
    position: NodeToolbarPosition;
    attributes: PartAttributes;
    selected: boolean;
}

/**
 * A toolbar next to a node (`data-flow-part="toolbar"`), on the app's element inside `[flowNode]`:
 * `<div flowNodeToolbar>`, moved into `[flowRoot]` (outside the zoom) at the anchor
 * `node-toolbar-by` gives, so it keeps its size at any zoom. It is in the document only while it
 * is shown (`open`; by default while its node is selected). Presses and the wheel over it are left
 * to it. It holds only what the app writes (its buttons).
 */
@Directive({ selector: "[flowNodeToolbar]", exportAs: "flowNodeToolbar" })
export class FlowNodeToolbarDirective {
    /** its node; default the enclosing `[flowNode]`'s */
    readonly nodeId = input<string | undefined>(undefined);
    /** the node's side it stands on; default `"top"` */
    readonly side = input<HandleSide | undefined>(undefined);
    /** where along that side; default `"center"` */
    readonly align = input<"start" | "center" | "end" | undefined>(undefined);
    /** the gap between the node and the toolbar, in pixels; default 10 */
    readonly offset = input(undefined, { transform: optionalNumber });
    /** whether it is shown; default while its node is selected (`selection()`) */
    readonly open = input(undefined, { transform: optionalBoolean });

    private readonly context = injectFlowContext("[flowNodeToolbar]");
    private readonly id = partOwnerId(
        "[flowNodeToolbar]",
        this.nodeId,
        injectNodeContext(),
        "node",
    );
    private readonly view = flowValue(
        this.context,
        (): ToolbarView | undefined => {
            const engine = this.context.engine();
            const nodeId = this.id();
            if (!engine || nodeId === undefined) return undefined;
            const position = engine.get("node-toolbar-by", {
                nodeId,
                side: this.side() ?? "top",
                align: this.align(),
                offset: this.offset(),
            });
            return position
                ? {
                      position,
                      attributes: engine.adapter.attributes("toolbar", {
                          nodeId,
                      }),
                      selected: this.context
                          .model()
                          .is("node-selected", { nodeId }),
                  }
                : undefined;
        },
    );

    /** the toolbar's state (`null` while it is not shown) */
    readonly state: Signal<NodeToolbarState | null> = computed(() => {
        const view = this.view();
        const nodeId = this.id();
        const shown = this.open() ?? view?.selected ?? false;
        if (!view || !shown || nodeId === undefined) return null;
        return { nodeId, position: view.position, side: this.side() ?? "top" };
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
