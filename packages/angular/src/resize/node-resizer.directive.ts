import { computed, Directive, effect, input, type Signal } from "@angular/core";
import type { ResizeDirection } from "@fragiola/flow/resize";
import {
    ɵbindAttributes as bindAttributes,
    ɵbindStructuralStyle as bindStructuralStyle,
    ɵdefaultContent as defaultContent,
    ɵflowValue as flowValue,
    ɵinjectFlowContext as injectFlowContext,
    ɵinjectHost as injectHost,
    ɵinjectNodeContext as injectNodeContext,
    ɵoptionalBoolean as optionalBoolean,
    ɵoptionalNumber as optionalNumber,
    ɵpartOwnerId as partOwnerId,
} from "@fragiola/flow-angular";
import { bindResizeHandle, RESIZE_POSITIONS } from "./resize-handle.directive";

export interface NodeResizerState {
    readonly nodeId: string;
    /** its node is being resized: `data-resizing` */
    readonly resizing: boolean;
}

/**
 * A node's resizer (`data-flow-part="resizer"`, `resize()`), on the app's element inside
 * `[flowNode]`: `<div flowNodeResizer [minWidth]="40">`, a box over the node holding its
 * `[flowResizeHandle]`s (when the app writes none, one at each corner and side); its limits are
 * this node's own (`setPartOptions`). Render it only when the node should be resizable (while it
 * is selected, say).
 */
@Directive({ selector: "[flowNodeResizer]", exportAs: "flowNodeResizer" })
export class FlowNodeResizerDirective {
    /** its node; default the enclosing `[flowNode]`'s */
    readonly nodeId = input<string | undefined>(undefined);
    /** this node's limits, over `resize()`'s (in flow units) */
    readonly minWidth = input(undefined, { transform: optionalNumber });
    readonly minHeight = input(undefined, { transform: optionalNumber });
    readonly maxWidth = input(undefined, { transform: optionalNumber });
    readonly maxHeight = input(undefined, { transform: optionalNumber });
    /** this node keeps its aspect ratio, over `resize()`'s */
    readonly keepAspectRatio = input(undefined, {
        transform: optionalBoolean,
    });
    /**
     * the sides its handles move: `"horizontal"` only the width (and x), `"vertical"` only the
     * height (and y); default both. A corner then moves its one dimension
     */
    readonly direction = input<ResizeDirection | undefined>(undefined);

    private readonly context = injectFlowContext("[flowNodeResizer]");
    private readonly id = partOwnerId(
        "[flowNodeResizer]",
        this.nodeId,
        injectNodeContext(),
        "node",
    );
    private readonly attributes = flowValue(this.context, () => {
        const nodeId = this.id();
        if (nodeId === undefined) return undefined;
        const engine = this.context.engine();
        return engine
            ? engine.adapter.attributes("resizer", { nodeId })
            : { "data-flow-part": "resizer", "data-flow-id": nodeId };
    });

    /** the resizer's state */
    readonly state: Signal<NodeResizerState | undefined> = computed(() => {
        const nodeId = this.id();
        const attributes = this.attributes();
        return nodeId === undefined || !attributes
            ? undefined
            : {
                  nodeId,
                  resizing: attributes["data-resizing"] !== undefined,
              };
    });

    constructor() {
        const host = injectHost();
        bindAttributes(host, () => this.attributes() ?? {});
        bindStructuralStyle(host, () => ({
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
        }));
        // this node's limits, while the resizer is there
        effect((onCleanup) => {
            const engine = this.context.engine();
            const nodeId = this.id();
            if (!engine || nodeId === undefined) return;
            const options = Object.fromEntries(
                Object.entries({
                    minWidth: this.minWidth(),
                    minHeight: this.minHeight(),
                    maxWidth: this.maxWidth(),
                    maxHeight: this.maxHeight(),
                    keepAspectRatio: this.keepAspectRatio(),
                    direction: this.direction(),
                }).filter(([, value]) => value !== undefined),
            );
            engine.adapter.setPartOptions("resizer", nodeId, options);
            onCleanup(() =>
                engine.adapter.setPartOptions("resizer", nodeId, null),
            );
        });
        // React's default children: a handle at each corner and side
        defaultContent(host, (document) =>
            RESIZE_POSITIONS.map((position) => {
                const handle = document.createElement("div");
                bindResizeHandle(handle, this.context, this.id, () => position);
                return handle;
            }),
        );
    }
}
