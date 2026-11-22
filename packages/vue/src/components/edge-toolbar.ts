import type { EdgeToolbarPosition, PartAttributes, XY } from "@fragiola/flow";
import { h, inject, onScopeDispose, shallowRef, Teleport } from "vue";
import { useFlowValue } from "../composables/internal";
import { EdgeLabelLayerKey, useEdgeId, useFlowContext } from "../context";
import {
    definePrimitive,
    type FlowComponent,
    type PrimitiveProps,
    type SlotFunction,
} from "../utils/primitive";
import { onClient, px, type RenderSlot, renderElement } from "../utils/render";

export interface EdgeToolbarState {
    readonly edgeId: string;
    /** the point of the edge it stands at */
    readonly position: "label" | "source" | "target";
    /** where it is anchored (its centre), in pixels relative to the root */
    readonly anchor: EdgeToolbarPosition;
}

export interface EdgeToolbarProps extends PrimitiveProps {
    /** its edge; default the enclosing `Flow.Edge`'s */
    edgeId?: string | undefined;
    /** the point of the edge it stands at: its label point, its source or its target end; default `"label"` */
    position?: "label" | "source" | "target" | undefined;
    /** a screen offset from that point, in pixels; default `{ x: 0, y: 0 }` */
    offset?: XY | undefined;
    /** whether it is shown; default while its edge is selected (`selection()`) */
    open?: boolean | undefined;
}

export interface EdgeToolbarSlots extends RenderSlot<EdgeToolbarState> {
    /** your buttons */
    default?: SlotFunction<{ state: EdgeToolbarState }>;
}

interface ToolbarView {
    anchor: EdgeToolbarPosition;
    attributes: PartAttributes;
    selected: boolean;
}

let nextToolbarKey = 0;

/**
 * A toolbar on an edge (`data-flow-part="toolbar"`, `data-flow-id` its edge's id), outside the
 * zoom: rendered in `Flow.Root` (a `Teleport`), centred at the point `edge-toolbar-by` gives (the
 * edge's label point or one of its ends), so it keeps its size at any zoom. Inside `Flow.Edges`
 * (SVG) it renders from the edges' HTML layer, whose `Teleport` creates HTML. Presses and the
 * wheel over it are left to it. It renders only its default slot (your buttons).
 */
export const EdgeToolbar: FlowComponent<EdgeToolbarProps, EdgeToolbarSlots> =
    definePrimitive<EdgeToolbarProps, EdgeToolbarSlots>(
        "EdgeToolbar",
        ["edgeId", "position", "offset", "open", "as"],
        (props, { attrs, slots }) => {
            const context = useFlowContext("EdgeToolbar");
            const { model } = context;
            const edgeId = useEdgeId("EdgeToolbar", () => props.edgeId);
            const layer = inject(EdgeLabelLayerKey, null);
            const view = useFlowValue<ToolbarView | undefined>(context, () => {
                const engine = context.engine.value;
                if (!engine) return undefined;
                const id = edgeId();
                const anchor = engine.get("edge-toolbar-by", {
                    edgeId: id,
                    position: props.position ?? "label",
                    offset: props.offset,
                });
                return anchor
                    ? {
                          anchor,
                          attributes: engine.adapter.attributes("toolbar", {
                              edgeId: id,
                          }),
                          selected: model.is("edge-selected", { edgeId: id }),
                      }
                    : undefined;
            });
            // the toolbar, teleported into the root
            const render = () => {
                const current = view.value;
                const root = context.rootElement.value;
                const shown = props.open ?? current?.selected ?? false;
                if (!current || !shown || !root) return null;
                const state: EdgeToolbarState = {
                    edgeId: edgeId(),
                    position: props.position ?? "label",
                    anchor: current.anchor,
                };
                const { x, y, anchorX, anchorY } = current.anchor;
                return h(Teleport, { to: root }, [
                    renderElement({
                        tag: "div",
                        as: props.as,
                        attrs,
                        render: slots.render,
                        state,
                        props: { ...current.attributes },
                        style: {
                            position: "absolute",
                            top: "0",
                            left: "0",
                            transform: `translate(${px(x)}, ${px(y)}) translate(${-anchorX * 100}%, ${-anchorY * 100}%)`,
                        },
                        children: () => slots.default?.({ state }),
                    }),
                ]);
            };
            if (!layer) return render;
            // inside the edges' SVG, a `Teleport` would keep creating SVG elements: the HTML layer
            // renders it (its attributes and slots are not reactive: a change renders it again)
            const version = shallowRef(0);
            onClient(() => {
                const remove = layer.add({
                    key: `toolbar-${nextToolbarKey++}`,
                    edgeId,
                    render,
                    version,
                });
                onScopeDispose(remove);
            });
            let renders = 0;
            return () => {
                version.value = ++renders;
                return null;
            };
        },
        { booleans: ["open"] },
    );
