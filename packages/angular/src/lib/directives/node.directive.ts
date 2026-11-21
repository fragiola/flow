import { computed, Directive, inject, input, type Signal } from "@angular/core";
import type { AnyTypes, FlowNode, FlowTypes } from "@fragiola/flow";
import { FLOW_NODE, injectFlowContext, type NodeContext } from "../context";
import { bindNode, type NodeState } from "../inject/inject-node";
import { beforeInputs, injectHost } from "../utils/helpers";

/**
 * One node (`data-flow-part="node"`, `data-flow-id`), on the app's element:
 * `<div [flowNode]="node">`, inside `<ng-template flowNodesItem let-node>`. It is absolutely
 * positioned at its place in the viewport (a structural `transform`), registered with the engine,
 * which measures it and resolves presses on it (drag, select, connect from its handles). It renders
 * only what the app writes: the content, `[flowHandle]`s, a resizer, a toolbar, which belong to it.
 * Its state is in its `data-*` and in `#n="flowNode"` (`n.state()?.selected`).
 */
@Directive({
    selector: "[flowNode]",
    exportAs: "flowNode",
    providers: [
        {
            provide: FLOW_NODE,
            useFactory: (): NodeContext => inject(FlowNodeDirective).context,
        },
    ],
})
export class FlowNodeDirective<T extends FlowTypes = AnyTypes> {
    /** the node it renders: the one `flowNodesItem` gives its template */
    readonly flowNode = input.required<FlowNode<T>>();

    private readonly node = computed(() =>
        beforeInputs(undefined, () => this.flowNode()),
    );

    /** @internal what the parts inside it inject */
    readonly context: NodeContext = {
        nodeId: computed(() => this.node()?.id),
    };

    /** the node's state (`undefined` on a binding's first read, before its input is set) */
    readonly state: Signal<NodeState<T> | undefined> = bindNode<T>(
        injectFlowContext("[flowNode]"),
        injectHost(),
        this.node,
    ).state;
}
