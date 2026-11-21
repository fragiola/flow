import { computed, Directive, input, type Signal } from "@angular/core";
import { type MinimapView, partAttributes } from "@fragiola/flow";
import {
    ɵbeforeInputs as beforeInputs,
    ɵbindAttributes as bindAttributes,
    ɵbindPresence as bindPresence,
    type ɵFlowContext as FlowContext,
    ɵflowValue as flowValue,
    ɵinjectFlowContext as injectFlowContext,
    ɵinjectHost as injectHost,
} from "@fragiola/flow-angular";
import { injectMiniMapView } from "./mini-map-context";

export interface MiniMapNodeState {
    readonly nodeId: string;
    /** `data-selected` (`selection()`) */
    readonly selected: boolean;
}

/** @internal binds a node's box onto `element`, out of the document while the node is not shown */
export function bindMiniMapNode(
    context: FlowContext,
    element: Element,
    view: Signal<MinimapView>,
    nodeId: () => string | undefined,
): Signal<MiniMapNodeState | undefined> {
    const attributes = flowValue(context, () => {
        const id = nodeId();
        if (id === undefined) return undefined;
        const engine = context.engine();
        return engine
            ? engine.adapter.attributes("minimap-node", { nodeId: id })
            : partAttributes("minimap-node", id);
    });
    const box = computed(() => {
        const id = nodeId();
        return view().nodes.find((node) => node.nodeId === id);
    });
    bindAttributes(element, () => {
        const shown = box();
        return {
            ...attributes(),
            x: shown === undefined ? undefined : String(shown.x),
            y: shown === undefined ? undefined : String(shown.y),
            width: shown === undefined ? undefined : String(shown.width),
            height: shown === undefined ? undefined : String(shown.height),
        };
    });
    bindPresence(element, () => (box() ? "here" : null));
    return computed(() => {
        const id = nodeId();
        const own = attributes();
        if (id === undefined || !own) return undefined;
        return { nodeId: id, selected: own["data-selected"] !== undefined };
    });
}

/**
 * A node in the minimap (`data-flow-part="minimap-node"`, `data-flow-id`), on the app's SVG rect
 * inside `[flowMiniMap]`: `<svg:rect flowMiniMapNode [nodeId]="id" />`, the node's box in flow
 * coordinates. Out of the document while the node is not shown.
 */
@Directive({ selector: "[flowMiniMapNode]", exportAs: "flowMiniMapNode" })
export class FlowMiniMapNodeDirective {
    /** the node it stands for */
    readonly nodeId = input.required<string>();

    /** the node's state in the map */
    readonly state: Signal<MiniMapNodeState | undefined>;

    constructor() {
        this.state = bindMiniMapNode(
            injectFlowContext("[flowMiniMapNode]"),
            injectHost<SVGElement>(),
            injectMiniMapView("[flowMiniMapNode]"),
            () => beforeInputs(undefined, this.nodeId),
        );
    }
}
