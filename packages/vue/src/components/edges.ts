import {
    type AnyTypes,
    type FlowEdge,
    type FlowTypes,
    partAttributes,
} from "@fragiola/flow";
import {
    defineComponent,
    h,
    type PropType,
    provide,
    type Slot,
    shallowRef,
} from "vue";
import { useFlowValue } from "../composables/internal";
import {
    EdgeKey,
    type EdgeLabelEntry,
    type EdgeLabelLayer,
    EdgeLabelLayerKey,
    useFlowContext,
} from "../context";
import {
    definePrimitive,
    type FlowComponent,
    type PrimitiveProps,
    type SlotFunction,
} from "../utils/primitive";
import { type RenderSlot, renderElement } from "../utils/render";

export interface EdgesState {
    /** how many edges are drawn */
    count: number;
}

export interface EdgesProps extends PrimitiveProps {}

export interface EdgesSlots<T extends FlowTypes = AnyTypes>
    extends RenderSlot<EdgesState> {
    /**
     * draws one edge (`v-slot="{ edge }"`): usually a `Flow.Edge` (an SVG group) with its path and
     * label. Each edge's slot renders again when its edge changes, or a reactive value it reads
     * does
     */
    default?: SlotFunction<{ edge: FlowEdge<T> }>;
}

const LAYER_STYLE = {
    position: "absolute",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    overflow: "visible",
    pointerEvents: "none",
};

/**
 * One edge's drawing, again only when its edge changes, a reactive value its slot reads does, or
 * the slot is a new one; its path renders again by itself (`Flow.EdgePath` follows `edge-path-by`).
 */
const EdgeSlot = defineComponent({
    name: "FlowEdgeSlot",
    props: {
        edge: { type: Object as PropType<FlowEdge>, required: true },
        // the slot itself: a new one (a render function's, or a slot that reads an outer slot's
        // scope) renders every entity again, a compiled template's stays the same
        slot: { type: Function as PropType<Slot>, required: false },
    },
    setup(props) {
        return () => props.slot?.({ edge: props.edge });
    },
});

/** A label in the HTML layer: its edge provided again, so its content sits in its edge. */
const EdgeLabelOutlet = defineComponent({
    name: "FlowEdgeLabelOutlet",
    props: {
        entry: { type: Object as PropType<EdgeLabelEntry>, required: true },
    },
    setup(props) {
        provide(EdgeKey, { edgeId: () => props.entry.edgeId() });
        return () => {
            props.entry.version.value;
            return props.entry.render();
        };
    },
});

/**
 * The layer of the edges (`data-flow-part="edges"`), inside `Flow.Viewport`, before `Flow.Nodes`:
 * an SVG (`data-flow-part="edges"` too) where the default slot draws each edge, once both its
 * nodes have a size (`edge-path-by`), and the HTML layer edge labels render in. It lets presses
 * through to the pane; the edges' own parts take them.
 *
 * ```vue
 * <Flow.Edges v-slot="{ edge }"><Flow.Edge :edge="edge" /></Flow.Edges>
 * ```
 */
export const Edges: FlowComponent<EdgesProps, EdgesSlots> = definePrimitive<
    EdgesProps,
    EdgesSlots
>("Edges", ["as"], (props, { attrs, slots }) => {
    const context = useFlowContext("Edges");
    const { model } = context;
    const list = useFlowValue(context, () => {
        const engine = context.engine.value;
        if (!engine) return [];
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
    // the labels of the edges, rendered in the HTML layer (SVG holds no HTML)
    const labels = shallowRef<readonly EdgeLabelEntry[]>([]);
    const layer: EdgeLabelLayer = {
        add(entry) {
            labels.value = [...labels.value, entry];
            return () => {
                labels.value = labels.value.filter((other) => other !== entry);
            };
        },
    };
    provide(EdgeLabelLayerKey, layer);
    return () => {
        const edges = list.value;
        return renderElement({
            tag: "div",
            as: props.as,
            attrs,
            render: slots.render,
            state: { count: edges.length },
            props: { ...partAttributes("edges") },
            style: LAYER_STYLE,
            children: () => [
                h(
                    "svg",
                    { ...partAttributes("edges"), style: LAYER_STYLE },
                    edges.map((edge) =>
                        h(EdgeSlot, {
                            key: edge.id,
                            edge,
                            slot: slots.default as Slot | undefined,
                        }),
                    ),
                ),
                ...labels.value.map((entry) =>
                    h(EdgeLabelOutlet, { key: entry.key, entry }),
                ),
            ],
        });
    };
});
