<script module lang="ts">
    import type { Snippet } from "svelte";
    import type {
        HandleState,
        UseHandleOptions,
    } from "../runes/use-handle.svelte.js";
    import type { DivPrimitiveProps } from "../utils/render.js";

    export interface HandleProps
        extends Omit<DivPrimitiveProps<HandleState>, "children">,
            UseHandleOptions {
        children?: Snippet<[{ state: HandleState }]> | undefined;
    }

    /** Where a handle sits by default: centred on its side of the node (a style may move it). */
    const SIDE_STYLE: Record<HandleProps["side"], Record<string, string>> = {
        top: { top: "0", left: "50%", transform: "translate(-50%, -50%)" },
        right: {
            top: "50%",
            left: "100%",
            transform: "translate(-50%, -50%)",
        },
        bottom: {
            top: "100%",
            left: "50%",
            transform: "translate(-50%, -50%)",
        },
        left: { top: "50%", left: "0", transform: "translate(-50%, -50%)" },
    };

    const HANDLE_STYLE = { position: "absolute" };
</script>

<!--
    @component
    A node's connection point (`data-flow-part="handle"`, `data-handle-type`, `data-side`), inside
    `Flow.Node`: registered with the engine (D8), which measures its centre; with `connection()`, a
    press on it draws a connection. Absolutely positioned at the middle of its `side` by default;
    your `style` may place it elsewhere on the node. Give it its size and look.
-->
<script lang="ts">
    import { useHandle } from "../runes/use-handle.svelte.js";
    import {
        elementProps,
        refProps,
        type RenderedProps,
    } from "../utils/render.js";

    let {
        type,
        side,
        handleId,
        connectable,
        connectableStart,
        connectableEnd,
        nodeId,
        children,
        render,
        class: className,
        style,
        ref = $bindable(),
        ...rest
    }: HandleProps = $props();

    const handle = useHandle(() => ({
        type,
        side,
        handleId,
        connectable,
        connectableStart,
        connectableEnd,
        nodeId,
    }));
    const refs = refProps((element) => {
        ref = element as HTMLDivElement | null;
    });
    const attrs: RenderedProps<HTMLDivElement> = $derived(
        elementProps({
            rest,
            className,
            style,
            state: handle.state,
            own: { ...handle.props, ...refs },
            structural: HANDLE_STYLE,
            baseStyle: SIDE_STYLE[side],
        }),
    );
</script>

{#snippet content()}{@render children?.({ state: handle.state })}{/snippet}

{#if render}
    {@render render({ props: attrs as never, state: handle.state, children: content })}
{:else}
    <div {...attrs}>{@render content()}</div>
{/if}
