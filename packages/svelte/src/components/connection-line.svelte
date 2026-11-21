<script module lang="ts">
    import type { Connection } from "@fragiola/flow";
    import type { Snippet } from "svelte";
    import type { SvgPrimitiveProps } from "../utils/render.js";

    export interface ConnectionLineState {
        /** the connection being drawn */
        readonly connection: Connection;
        /** the drop would add the edge: `data-valid` */
        readonly valid: boolean;
        /** the drop would be refused (`model.can("edge.add")`, a middleware's veto): `data-invalid` */
        readonly invalid: boolean;
    }

    export interface ConnectionLineProps
        extends Omit<
            SvgPrimitiveProps<ConnectionLineState, SVGSVGElement>,
            "children"
        > {
        /**
         * draws the line, in flow coordinates (`{#snippet children(connection)}`); default an
         * unfilled `<path>` of the connection's path (`data-flow-part="connection-path"`)
         */
        children?: Snippet<[Connection]> | undefined;
    }

    const LINE_STYLE = {
        position: "absolute",
        top: "0",
        left: "0",
        width: "100%",
        height: "100%",
        overflow: "visible",
        "pointer-events": "none",
    };
</script>

<!--
    @component
    The connection being drawn (`data-flow-part="connection-line"`, `data-valid` / `data-invalid`,
    `connection()`): an SVG inside `Flow.Viewport`, rendered only while a connection is under way.
-->
<script lang="ts">
    import { useFlowContext } from "../context.js";
    import { flowValue } from "../runes/internal.svelte.js";
    import { useConnection } from "../runes/use-connection.svelte.js";
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
    }: ConnectionLineProps = $props();

    const context = useFlowContext("ConnectionLine");
    const connection = useConnection();
    const attributes = flowValue(
        context,
        () => context.engine?.adapter.attributes("connection-line") ?? {},
    );
    const refs = refProps((element) => {
        ref = element as SVGSVGElement | null;
    });
    const partState = $derived.by((): ConnectionLineState | undefined => {
        const current = connection.current;
        const own = attributes.current;
        return current
            ? {
                  connection: current,
                  valid: own["data-valid"] !== undefined,
                  invalid: own["data-invalid"] !== undefined,
              }
            : undefined;
    });
    const attrs: RenderedProps<SVGSVGElement> = $derived(
        partState
            ? elementProps({
                  rest,
                  className,
                  style,
                  state: partState,
                  own: {
                      ...attributes.current,
                      "data-flow-part": "connection-line",
                      ...refs,
                  },
                  structural: LINE_STYLE,
              })
            : ({} as RenderedProps<SVGSVGElement>),
    );
</script>

{#snippet content()}
    {#if partState}
        {#if children}
            {@render children(partState.connection)}
        {:else}
            <path
                data-flow-part="connection-path"
                d={partState.connection.path}
                fill="none"
            />
        {/if}
    {/if}
{/snippet}

{#if partState}
    {#if render}
        {@render render({ props: attrs as never, state: partState, children: content })}
    {:else}
        <svg {...attrs}>{@render content()}</svg>
    {/if}
{/if}
