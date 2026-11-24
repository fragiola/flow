<script module lang="ts">
    import type { EdgePath } from "@fragiola/flow";
    import type { Snippet } from "svelte";
    import type { DivPrimitiveProps } from "../utils/render.js";

    export interface EdgeLabelState {
        readonly edgeId: string;
        /** the edge's path, label point and ends */
        readonly path: EdgePath;
        /** `data-selected` (`selection()`) */
        readonly selected: boolean;
    }

    export interface EdgeLabelProps
        extends Omit<DivPrimitiveProps<EdgeLabelState>, "children"> {
        /** the edge; default the enclosing `Flow.Edge`'s */
        edgeId?: string | undefined;
        children?: Snippet<[{ state: EdgeLabelState }]> | undefined;
    }
</script>

<!--
    @component
    An edge's label (`data-flow-part="edge-label"`): HTML, centred on the path's label point in
    flow coordinates, in the HTML layer of `Flow.Edges` (a portal: SVG holds no HTML). It renders
    only its children; a press on it selects its edge.
-->
<script lang="ts">
    import {
        useEdgeId,
        useEdgeLabelLayer,
        useFlowContext,
    } from "../context.js";
    import { flowValue, sameValue } from "../runes/internal.svelte.js";
    import {
        edgePathValue,
        staticAttributes,
    } from "../runes/use-edge.svelte.js";
    import Portal from "../utils/portal.svelte";
    import {
        elementProps,
        px,
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
    }: EdgeLabelProps = $props();

    const edgeIdOf = useEdgeId("EdgeLabel", () => edgeIdProp);
    const layer = useEdgeLabelLayer();
    const context = useFlowContext("EdgeLabel");
    const path = edgePathValue(context, edgeIdOf);
    // the engine's attributes, or before it (the server, the first render) the document's
    const attributes = flowValue(context, () => {
        const edgeId = edgeIdOf();
        const { engine, model } = context;
        return engine
            ? engine.adapter.attributes("edge-label", { edgeId })
            : staticAttributes(
                  "edge-label",
                  edgeId,
                  model.get("edge-by", { id: edgeId }),
              );
    },
        sameValue,
        { entity: () => ({ kind: "edge", id: edgeIdOf() }) },
    );
    const refs = refProps((element) => {
        ref = element as HTMLDivElement | null;
    });
    const partState = $derived.by((): EdgeLabelState | undefined => {
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
    const attrs: RenderedProps<HTMLDivElement> = $derived.by(() => {
        if (!partState) return {} as RenderedProps<HTMLDivElement>;
        const { x, y } = partState.path.label;
        return elementProps({
            rest,
            className,
            style,
            state: partState,
            own: { ...attributes.current, ...refs },
            structural: {
                position: "absolute",
                top: "0",
                left: "0",
                transform: `translate(${px(x)}, ${px(y)}) translate(-50%, -50%)`,
                "pointer-events": "all",
            },
        });
    });
</script>

{#snippet content()}
    {#if partState}{@render children?.({ state: partState })}{/if}
{/snippet}

{#snippet label()}
    {#if partState}
        {#if render}
            {@render render({ props: attrs as never, state: partState, children: content })}
        {:else}
            <div {...attrs}>{@render content()}</div>
        {/if}
    {/if}
{/snippet}

{#if partState}
    <Portal target={layer?.elementOf(edgeIdOf())}>{@render label()}</Portal>
{/if}
