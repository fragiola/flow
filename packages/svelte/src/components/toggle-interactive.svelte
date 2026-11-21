<script module lang="ts">
    import type { Snippet } from "svelte";
    import type { ButtonPrimitiveProps } from "../utils/render.js";

    export interface ToggleInteractiveState {
        /** the gestures and keys may change the flow */
        readonly interactive: boolean;
    }

    export interface ToggleInteractiveProps
        extends Omit<
            ButtonPrimitiveProps<ToggleInteractiveState>,
            "children"
        > {
        /** its content (an icon, a label) */
        children?: Snippet<[{ state: ToggleInteractiveState }]> | undefined;
    }
</script>

<!--
    @component
    A toggle button (`data-flow-part="toggle-interactive"`, `aria-pressed` while the flow is
    locked, `data-interactive`): locks and unlocks the flow (`set-interactive`): while locked,
    gestures and keys change nothing, pan and zoom stay. It renders only its children.
-->
<script lang="ts">
    import { useFlowContext } from "../context.js";
    import { flowValue } from "../runes/internal.svelte.js";
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
    }: ToggleInteractiveProps = $props();

    const context = useFlowContext("ToggleInteractive");
    const interactive = flowValue(context, () =>
        context.engine ? context.engine.is("interactive") : true,
    );
    const refs = refProps((element) => {
        ref = element as HTMLButtonElement | null;
    });
    const onclick = () => {
        context.engine?.run("set-interactive", {
            interactive: !interactive.current,
        });
    };
    const partState = $derived<ToggleInteractiveState>({
        interactive: interactive.current,
    });
    const attrs: RenderedProps<HTMLButtonElement> = $derived(
        elementProps({
            rest,
            className,
            style,
            state: partState,
            own: {
                type: "button",
                "data-flow-part": "toggle-interactive",
                "data-interactive": partState.interactive ? "" : undefined,
                "aria-pressed": !partState.interactive,
                disabled: context.engine === null,
                onclick,
                ...refs,
            },
        }),
    );
</script>

{#snippet content()}{@render children?.({ state: partState })}{/snippet}

{#if render}
    {@render render({ props: attrs as never, state: partState, children: content })}
{:else}
    <button {...attrs}>{@render content()}</button>
{/if}
