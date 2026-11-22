<script module lang="ts">
    import type { Viewport as ViewportValue } from "@fragiola/flow";
    import type { Snippet } from "svelte";
    import type { DivPrimitiveProps } from "../utils/render.js";

    export interface ViewportState {
        /** the viewport: the pan (`x`, `y`, pixels) and the zoom */
        viewport: ViewportValue;
    }

    export interface ViewportProps
        extends Omit<DivPrimitiveProps<ViewportState>, "children"> {
        /** what is in flow coordinates: `Flow.Edges`, `Flow.Nodes`, `Flow.ConnectionLine` */
        children?: Snippet<[{ state: ViewportState }]> | undefined;
    }

    const VIEWPORT_STYLE = {
        position: "absolute",
        top: "0",
        left: "0",
        width: "100%",
        height: "100%",
        // a stacking context of its own before the engine writes its transform (the server's
        // HTML): with several render levels the nodes and edge layers have negative z-indexes
        isolation: "isolate",
    };
</script>

<!--
    The pannable, zoomable layer (`data-flow-part="viewport"`): what is inside is in flow
    coordinates (`Flow.Edges`, `Flow.Nodes`, `Flow.ConnectionLine`). The engine writes its
    `transform` itself (D4), never Svelte: a pan or a zoom re-renders nothing inside it.
-->
<script lang="ts">
    import { partAttributes } from "@fragiola/flow";
    import { untrack } from "svelte";
    import { createAttachmentKey } from "svelte/attachments";
    import { useFlowContext } from "../context.js";
    import { useViewport } from "../runes/use-viewport.svelte.js";
    import {
        elementProps,
        refProps,
        type RenderedProps,
    } from "../utils/render.js";

    let {
        children,
        render,
        class: className,
        style,
        ref = $bindable(),
        ...rest
    }: ViewportProps = $props();

    const context = useFlowContext("Viewport");
    const viewport = useViewport();
    const refs = refProps((element) => {
        ref = element as HTMLDivElement | null;
    });
    const engineKey = createAttachmentKey();
    const own = {
        ...partAttributes("viewport"),
        ...refs,
        [engineKey]: (element: Element) => {
            const engine = context.engine;
            if (!engine) return;
            engine.adapter.attachViewport(element as HTMLElement);
            return () => engine.adapter.attachViewport(null);
        },
    };
    // the viewport is read by the state only when a consumer reads it (a pan re-renders nothing)
    const partState: ViewportState = {
        get viewport() {
            return viewport.current;
        },
    };
    // the engine writes the transform on its element (D4), never Svelte; but a new style string
    // (the consumer's style changed) replaces the element's whole style, so it carries the
    // transform the engine wrote last, read without following it: a pan derives nothing here
    const engineStyle = () =>
        untrack(() => {
            const engine = context.engine;
            if (!engine) return {};
            const { x, y, zoom } = engine.get("viewport");
            return {
                "transform-origin": "0 0",
                transform: `translate(${x}px, ${y}px) scale(${zoom})`,
            };
        });
    const attrs: RenderedProps<HTMLDivElement> = $derived(
        elementProps({
            rest,
            className,
            style,
            state: partState,
            own,
            structural: { ...VIEWPORT_STYLE, ...engineStyle() },
        }),
    );
</script>

{#snippet content()}{@render children?.({ state: partState })}{/snippet}

{#if render}
    {@render render({ props: attrs as never, state: partState, children: content })}
{:else}
    <div {...attrs}>{@render content()}</div>
{/if}
