import { Directive, input, type Signal } from "@angular/core";
import type { HandleSide, HandleType } from "@fragiola/flow";
import { injectFlowContext, injectNodeContext } from "../context";
import { bindHandle, type HandleState } from "../inject/inject-handle";
import { partOwnerId } from "../inject/internal";
import { beforeInputs, injectHost, optionalBoolean } from "../utils/helpers";

/**
 * A node's connection point (`data-flow-part="handle"`, `data-handle-type`, `data-side`), on the
 * app's element inside `[flowNode]`: `<div flowHandle type="source" side="bottom">`. It is
 * registered with the engine (D8), which measures its centre; with `connection()`, a press on it
 * draws a connection. Absolutely positioned at the middle of its `side` by default: the app's
 * style may place it elsewhere on the node. Give it its size and look.
 */
@Directive({ selector: "[flowHandle]", exportAs: "flowHandle" })
export class FlowHandleDirective {
    /** whether edges start (`source`) or end (`target`) here */
    readonly type = input.required<HandleType>();
    /** the side of the node it sits on: the direction its edges leave or enter by */
    readonly side = input.required<HandleSide>();
    /** its id among the node's handles of its type (none: the node's default handle) */
    readonly handleId = input<string | undefined>(undefined);
    /** whether a connection may start or end here; default true */
    readonly connectable = input(undefined, { transform: optionalBoolean });
    /** its node; default the enclosing `[flowNode]`'s */
    readonly nodeId = input<string | undefined>(undefined);

    /** the handle's state (`#h="flowHandle"`, then `h.state()?.valid`) */
    readonly state: Signal<HandleState | undefined>;

    constructor() {
        const nodeId = partOwnerId(
            "[flowHandle]",
            this.nodeId,
            injectNodeContext(),
            "node",
        );
        this.state = bindHandle(
            injectFlowContext("[flowHandle]"),
            injectHost(),
            () =>
                beforeInputs(undefined, () => ({
                    type: this.type(),
                    side: this.side(),
                    handleId: this.handleId(),
                    connectable: this.connectable(),
                    nodeId: nodeId(),
                })),
        ).state;
    }
}
