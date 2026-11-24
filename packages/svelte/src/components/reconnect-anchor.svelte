<script module lang="ts">
    import type { EdgePath } from "@fragiola/flow";
    import type { SvgPrimitiveProps } from "../utils/render.js";

    export interface ReconnectAnchorState {
        readonly edgeId: string;
        /** which end of the edge it moves */
        readonly end: "source" | "target";
        /** the edge's path and ends */
        readonly path: EdgePath;
        /** this edge's end is being moved */
        readonly reconnecting: boolean;
    }

    export interface ReconnectAnchorProps
        extends Omit<
            SvgPrimitiveProps<ReconnectAnchorState, SVGCircleElement>,
            "children"
        > {
        /** which end of the edge it moves */
        end: "source" | "target";
        /** the edge; default the enclosing `Flow.Edge`'s */
        edgeId?: string | undefined;
    }
</script>

<!--
    @component
    An edge end's grab area (`data-flow-part="reconnect-anchor"`, `data-end`): an SVG circle at the
    end, inside `Flow.Edge`. With `reconnection()`, a press on it moves that end to another handle;
    an end its edge's `reconnectable` keeps fixed (`false`, or the other end's name) draws none.
    Transparent by default; give it its radius (`r`, default 10) and look.
-->
<script lang="ts">
    import { useEdgeId, useFlowContext } from "../context.js";
    import { flowValue, sameValue } from "../runes/internal.svelte.js";
    import { edgePathValue } from "../runes/use-edge.svelte.js";
    import {
        elementProps,
        refProps,
        type RenderedProps,
    } from "../utils/render.js";

    let {
        edgeId: edgeIdProp,
        end,
        render,
        class: className,
        style,
        ref = $bindable(),
        ...rest
    }: ReconnectAnchorProps = $props();

    const edgeIdOf = useEdgeId("ReconnectAnchor", () => edgeIdProp);
    const context = useFlowContext("ReconnectAnchor");
    const path = edgePathValue(context, edgeIdOf);
    const view = flowValue(context, () => {
        const engine = context.engine;
        const edgeId = edgeIdOf();
        return engine
            ? {
                  attributes: engine.adapter.attributes("reconnect-anchor", {
                      edgeId,
                      end,
                  }),
                  reconnecting: engine.is("edge-reconnecting", { edgeId }),
                  // `reconnectable: "source"` (or `"target"`, or false): no anchor at the other end
                  movable: context.model.is("edge-reconnectable", { edgeId, end }),
              }
            : undefined;
    },
        sameValue,
        { entity: () => ({ kind: "edge", id: edgeIdOf() }) },
    );
    const refs = refProps((element) => {
        ref = element as SVGCircleElement | null;
    });
    const partState = $derived.by((): ReconnectAnchorState | undefined => {
        const current = path.current;
        const own = view.current;
        return current && own?.movable
            ? {
                  edgeId: edgeIdOf(),
                  end,
                  path: current,
                  reconnecting: own.reconnecting,
              }
            : undefined;
    });
    const attrs: RenderedProps<SVGCircleElement> = $derived.by(() => {
        if (!partState || !view.current) return {} as RenderedProps<SVGCircleElement>;
        const point = partState.path[partState.end];
        return elementProps({
            rest,
            className,
            style,
            state: partState,
            own: {
                ...view.current.attributes,
                cx: point.x,
                cy: point.y,
                r: 10,
                fill: "transparent",
                ...refs,
            },
            structural: { "pointer-events": "all" },
        });
    });
</script>

{#snippet content()}{/snippet}

{#if partState}
    {#if render}
        {@render render({ props: attrs as never, state: partState, children: content })}
    {:else}
        <circle {...attrs} />
    {/if}
{/if}
