<script module lang="ts">
    import type { Snippet } from "svelte";
    import type { ButtonPrimitiveProps } from "../utils/render.js";

    /** The switches the lock turns off and on (React Flow's: dragging, connecting, selecting). */
    const LOCKED_KINDS = ["drag", "connect", "select"] as const;

    export interface ToggleInteractiveState {
        /**
         * the flow is not locked: it is interactive and one of dragging, connecting and selecting
         * at least is on (`interactive-by`)
         */
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
    locked, `data-interactive`): locks and unlocks the flow, React Flow's interactive button:
    locking turns dragging, connecting and selecting off (`set-interactive { drag, connect,
    select }`), unlocking turns them and `interactive` on; pan and zoom stay. It renders only its
    children.
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
    const interactive = flowValue(context, () => {
        const engine = context.engine;
        return engine
            ? LOCKED_KINDS.some((kind) => engine.is("interactive-by", { kind }))
            : true;
    });
    const refs = refProps((element) => {
        ref = element as HTMLButtonElement | null;
    });
    const onclick = () => {
        context.engine?.run(
            "set-interactive",
            interactive.current
                ? { drag: false, connect: false, select: false }
                : { interactive: true, drag: true, connect: true, select: true },
        );
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
