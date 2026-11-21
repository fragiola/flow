<script module lang="ts">
    import type { EdgePath as EdgePathValue } from "@fragiola/flow";
    import type { SvgPrimitiveProps } from "../utils/render.js";

    export interface EdgePathState {
        readonly edgeId: string;
        /** the edge's path, label point and ends */
        readonly path: EdgePathValue;
        /** `data-selected` (`selection()`) */
        readonly selected: boolean;
    }

    export interface EdgePathProps
        extends Omit<
            SvgPrimitiveProps<EdgePathState, SVGPathElement>,
            "children"
        > {
        /** the edge; default the enclosing `Flow.Edge`'s */
        edgeId?: string | undefined;
    }
</script>

<!--
    @component
    An edge's path (`data-flow-part="edge-path"`): an SVG `<path>` whose `d` is the engine's
    (`edge-path-by`, D9), unfilled. A `d` of your own draws an app type (from `state.path`'s ends).
    Several may share an edge: a wide transparent one is a bigger press target.
-->
<script lang="ts">
    import { useEdgeId, useFlowContext } from "../context.js";
    import { flowValue } from "../runes/internal.svelte.js";
    import { edgePathValue } from "../runes/use-edge.svelte.js";
    import {
        elementProps,
        refProps,
        type RenderedProps,
    } from "../utils/render.js";

    let {
        edgeId: edgeIdProp,
        render,
        class: className,
        style,
        ref = $bindable(),
        ...rest
    }: EdgePathProps = $props();

    const edgeIdOf = useEdgeId("EdgePath", () => edgeIdProp);
    const context = useFlowContext("EdgePath");
    const path = edgePathValue(context, edgeIdOf);
    const attributes = flowValue(context, () =>
        context.engine?.adapter.attributes("edge-path", { edgeId: edgeIdOf() }),
    );
    const refs = refProps((element) => {
        ref = element as SVGPathElement | null;
    });
    const partState = $derived.by((): EdgePathState | undefined => {
        const current = path.current;
        const own = attributes.current;
        return current && own
            ? {
                  edgeId: edgeIdOf(),
                  path: current,
                  selected: own["data-selected"] !== undefined,
              }
            : undefined;
    });
    const attrs: RenderedProps<SVGPathElement> = $derived(
        partState
            ? elementProps({
                  rest,
                  className,
                  style,
                  state: partState,
                  own: {
                      ...attributes.current,
                      d: partState.path.path,
                      fill: "none",
                      ...refs,
                  },
              })
            : ({} as RenderedProps<SVGPathElement>),
    );
</script>

{#snippet content()}{/snippet}

{#if partState}
    {#if render}
        {@render render({ props: attrs as never, state: partState, children: content })}
    {:else}
        <path {...attrs} />
    {/if}
{/if}
