<script module lang="ts">
    import type { EdgeToolbarPosition, XY } from "@fragiola/flow";
    import type { Snippet } from "svelte";
    import type { DivPrimitiveProps } from "../utils/render.js";

    export interface EdgeToolbarState {
        readonly edgeId: string;
        /** the point of the edge it stands at */
        readonly position: "label" | "source" | "target";
        /** where it is anchored (its centre), in pixels relative to the root */
        readonly anchor: EdgeToolbarPosition;
    }

    export interface EdgeToolbarProps
        extends Omit<DivPrimitiveProps<EdgeToolbarState>, "children"> {
        /** its edge; default the enclosing `Flow.Edge`'s */
        edgeId?: string | undefined;
        /** the point of the edge it stands at: its label point, its source or its target end; default `"label"` */
        position?: "label" | "source" | "target" | undefined;
        /** a screen offset from that point, in pixels; default `{ x: 0, y: 0 }` */
        offset?: XY | undefined;
        /** whether it is shown; default while its edge is selected (`selection()`) */
        open?: boolean | undefined;
        /** your buttons */
        children?: Snippet<[{ state: EdgeToolbarState }]> | undefined;
    }
</script>

<!--
    @component
    A toolbar on an edge (`data-flow-part="toolbar"`, `data-flow-id` its edge's id), outside the
    zoom: rendered in `Flow.Root` (a portal), centred at the point `edge-toolbar-by` gives (the
    edge's label point or one of its ends), so it keeps its size at any zoom. Presses and the wheel
    over it are left to it. It renders only its children (your buttons).
-->
<script lang="ts">
    import { useEdgeId, useFlowContext } from "../context.js";
    import { flowValue } from "../runes/internal.svelte.js";
    import { plain } from "../utils/plain.svelte.js";
    import Portal from "../utils/portal.svelte";
    import {
        elementProps,
        px,
        refProps,
        type RenderedProps,
    } from "../utils/render.js";

    let {
        edgeId: edgeIdProp,
        position = "label",
        offset,
        open,
        children,
        render,
        class: className,
        style,
        ref = $bindable(),
        ...rest
    }: EdgeToolbarProps = $props();

    const edgeIdOf = useEdgeId("EdgeToolbar", () => edgeIdProp);
    const context = useFlowContext("EdgeToolbar");
    // hidden, it reads nothing of the view: a pan or a zoom gives the same value (nothing
    // updates); shown, an equal anchor keeps the last value
    const view = flowValue(context, () => {
        const { engine, model } = context;
        if (!engine) return undefined;
        const edgeId = edgeIdOf();
        if (!(open ?? model.is("edge-selected", { edgeId }))) return undefined;
        const anchor = engine.get("edge-toolbar-by", {
            edgeId,
            position,
            offset: plain(offset),
        });
        return anchor
            ? {
                  anchor,
                  attributes: engine.adapter.attributes("toolbar", { edgeId }),
              }
            : undefined;
    });
    const refs = refProps((element) => {
        ref = element as HTMLDivElement | null;
    });
    const partState = $derived.by((): EdgeToolbarState | undefined =>
        view.current
            ? { edgeId: edgeIdOf(), position, anchor: view.current.anchor }
            : undefined,
    );
    const attrs: RenderedProps<HTMLDivElement> = $derived.by(() => {
        if (!partState || !view.current) return {} as RenderedProps<HTMLDivElement>;
        const { x, y, anchorX, anchorY } = partState.anchor;
        return elementProps({
            rest,
            className,
            style,
            state: partState,
            own: { ...view.current.attributes, ...refs },
            structural: {
                position: "absolute",
                top: "0",
                left: "0",
                transform: `translate(${px(x)}, ${px(y)}) translate(${-anchorX * 100}%, ${-anchorY * 100}%)`,
            },
        });
    });
</script>

{#snippet content()}
    {#if partState}{@render children?.({ state: partState })}{/if}
{/snippet}

{#snippet toolbar()}
    {#if partState}
        {#if render}
            {@render render({ props: attrs as never, state: partState, children: content })}
        {:else}
            <div {...attrs}>{@render content()}</div>
        {/if}
    {/if}
{/snippet}

{#if partState}
    <Portal target={context.rootElement}>{@render toolbar()}</Portal>
{/if}
