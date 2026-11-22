import {
    type AnyTypes,
    edgesLayerAttributes,
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
import { type DrawnLayer, useDrawnLayers } from "../composables/internal";
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
 * nodes have a size (before the engine exists, from the document's sizes: a server render draws
 * them), in the engine's drawing order (`drawn-edges`: by stack value), and the HTML layer edge
 * labels render in. When some edges stand above nodes (`render-layers`, `zIndexMode`), each level
 * gets its own layer (`data-flow-part="edges-layer"`, `data-level`, at the level's `z-index`) with
 * its SVG and its labels, between the nodes below and above it. It lets presses through to the
 * pane; the edges' own parts take them.
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
    // the levels and their edges: shown, measured, in view with `onlyRenderVisible`, by z-order
    const layers = useDrawnLayers(context);
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
    const svg = (edges: readonly FlowEdge[]) =>
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
        );
    const outlets = (entries: readonly EdgeLabelEntry[]) =>
        entries.map((entry) => h(EdgeLabelOutlet, { key: entry.key, entry }));
    // several levels: each one's SVG and labels in its own layer (an edge's label in its edge's)
    const levels = (drawn: readonly DrawnLayer[]) => {
        const levelOf = new Map<string, number>();
        for (const [index, { edges }] of drawn.entries()) {
            for (const edge of edges) levelOf.set(edge.id, index);
        }
        const byLevel = drawn.map((): EdgeLabelEntry[] => []);
        for (const entry of labels.value) {
            byLevel[levelOf.get(entry.edgeId()) ?? 0]?.push(entry);
        }
        const engine = context.engine.value;
        return drawn.map(({ level, zIndex, edges }, index) =>
            h(
                "div",
                {
                    key: level,
                    ...(engine
                        ? engine.adapter.attributes("edges-layer", { level })
                        : edgesLayerAttributes(level)),
                    style: {
                        ...LAYER_STYLE,
                        ...(zIndex === undefined
                            ? {}
                            : { zIndex: String(zIndex) }),
                    },
                },
                [svg(edges), ...outlets(byLevel[index] ?? [])],
            ),
        );
    };
    return () => {
        const drawn = layers.value;
        const count = drawn.reduce((sum, { edges }) => sum + edges.length, 0);
        return renderElement({
            tag: "div",
            as: props.as,
            attrs,
            render: slots.render,
            state: { count },
            props: { ...partAttributes("edges") },
            style: LAYER_STYLE,
            children: () =>
                drawn.length > 1
                    ? levels(drawn)
                    : [svg(drawn[0]?.edges ?? []), ...outlets(labels.value)],
        });
    };
});
