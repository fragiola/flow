import { partAttributes, type Viewport as ViewportValue } from "@fragiola/flow";
import { useViewport } from "../composables/use-viewport";
import { useFlowContext } from "../context";
import {
    definePrimitive,
    type FlowComponent,
    type PrimitiveProps,
    type SlotFunction,
} from "../utils/primitive";
import { elementRef, type RenderSlot, renderElement } from "../utils/render";

export interface ViewportState {
    /** the viewport: the pan (`x`, `y`, pixels) and the zoom */
    viewport: ViewportValue;
}

export interface ViewportProps extends PrimitiveProps {}

export interface ViewportSlots extends RenderSlot<ViewportState> {
    /** what is in flow coordinates: `Flow.Edges`, `Flow.Nodes`, `Flow.ConnectionLine` */
    default?: SlotFunction<{ state: ViewportState }>;
}

const VIEWPORT_STYLE = {
    position: "absolute",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
};

/**
 * The pannable, zoomable layer (`data-flow-part="viewport"`): what is inside is in flow
 * coordinates (`Flow.Edges`, `Flow.Nodes`, `Flow.ConnectionLine`). The engine writes its
 * `transform` itself (D4), never Vue: a pan or a zoom re-renders nothing inside it, nor the
 * viewport itself unless its state is read (its `render` slot, a `class` or `style` function).
 */
export const Viewport: FlowComponent<ViewportProps, ViewportSlots> =
    definePrimitive<ViewportProps, ViewportSlots>(
        "Viewport",
        ["as"],
        (props, { attrs, slots }) => {
            const context = useFlowContext("Viewport");
            const viewport = useViewport();
            const ref = elementRef(
                (element) => {
                    const engine = context.engine.value;
                    if (!engine) return undefined;
                    engine.adapter.attachViewport(element as HTMLElement);
                    return () => engine.adapter.attachViewport(null);
                },
                () => [context.engine.value],
            );
            // read when used (a `render` slot, a `class` function): a pan re-renders the viewport
            // only for a consumer that shows it
            const state: ViewportState = {
                get viewport() {
                    return viewport.value;
                },
            };
            return () => {
                context.engine.value;
                return renderElement({
                    tag: "div",
                    as: props.as,
                    attrs,
                    render: slots.render,
                    state,
                    ref,
                    props: { ...partAttributes("viewport") },
                    style: VIEWPORT_STYLE,
                    children: () => slots.default?.({ state }),
                });
            };
        },
    );
