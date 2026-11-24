<script module lang="ts">
    import type { EdgePath as EdgePathValue } from "@fragiola/flow";
    import type { Snippet } from "svelte";
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
        /** SVG content inside the `<path>` (an `<animate>`, a `<title>`), given `{ state }` */
        children?: Snippet<[{ state: EdgePathState }]> | undefined;
    }
</script>

<!--
    @component
    An edge's path (`data-flow-part="edge-path"`): an SVG `<path>` whose `d` is the engine's
    (`edge-path-by`, D9; before the engine, the static geometry's), unfilled. A `d` of your own draws an app type (from `state.path`'s ends).
    Several may share an edge: a wide transparent one is a bigger press target. Its `children`
    snippet renders inside the `<path>` (an `<animate>`), given `{ state }`.
-->
<script lang="ts">
    import { useEdgeId, useFlowContext } from "../context.js";
    import { flowValue, sameValue } from "../runes/internal.svelte.js";
    import {
        edgePathValue,
        staticAttributes,
    } from "../runes/use-edge.svelte.js";
    import {
        elementProps,
        refProps,
        type RenderedProps,
    } from "../utils/render.js";

    let {
        edgeId: edgeIdProp,
        children,
        render,
        class: className,
        style,
        ref = $bindable(),
        ...rest
    }: EdgePathProps = $props();

    const edgeIdOf = useEdgeId("EdgePath", () => edgeIdProp);
    const context = useFlowContext("EdgePath");
    const path = edgePathValue(context, edgeIdOf);
    // the engine's attributes, or before it (the server, the first render) the document's
    const attributes = flowValue(context, () => {
        const edgeId = edgeIdOf();
        const { engine, model } = context;
        return engine
            ? engine.adapter.attributes("edge-path", { edgeId })
            : staticAttributes(
                  "edge-path",
                  edgeId,
                  model.get("edge-by", { id: edgeId }),
              );
    },
        sameValue,
        { entity: () => ({ kind: "edge", id: edgeIdOf() }) },
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

{#snippet content()}
    {#if partState}{@render children?.({ state: partState })}{/if}
{/snippet}

{#if partState}
    {#if render}
        {@render render({ props: attrs as never, state: partState, children: content })}
    {:else}
        <path {...attrs}>{@render content()}</path>
    {/if}
{/if}
