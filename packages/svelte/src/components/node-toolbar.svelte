<script module lang="ts">
    import type { HandleSide, NodeToolbarPosition } from "@fragiola/flow";
    import type { Snippet } from "svelte";
    import type { DivPrimitiveProps } from "../utils/render.js";

    export interface NodeToolbarState {
        /** its node (undefined for several nodes' toolbar) */
        readonly nodeId: string | undefined;
        /** the nodes it stands beside: `nodeIds`, or its one node */
        readonly nodeIds: readonly string[];
        /** where it is anchored, in pixels relative to the root */
        readonly position: NodeToolbarPosition;
        readonly side: HandleSide;
    }

    export interface NodeToolbarProps
        extends Omit<DivPrimitiveProps<NodeToolbarState>, "children"> {
        /** its node; default the enclosing `Flow.Node`'s */
        nodeId?: string | undefined;
        /**
         * several nodes it stands beside (their bounds), instead of one; when not empty it wins
         * over `nodeId`, and the toolbar is shown by default while every one of them is selected
         */
        nodeIds?: readonly string[] | undefined;
        /** the node's side it stands on; default `"top"` */
        side?: HandleSide | undefined;
        /** where along that side; default `"center"` */
        align?: "start" | "center" | "end" | undefined;
        /** the gap between the node and the toolbar, in pixels; default 10 */
        offset?: number | undefined;
        /** whether it is shown; default while its node (every node of `nodeIds`) is selected (`selection()`) */
        open?: boolean | undefined;
        /** your buttons */
        children?: Snippet<[{ state: NodeToolbarState }]> | undefined;
    }
</script>

<!--
    @component
    A toolbar next to a node, or beside several nodes' bounds (`nodeIds`; `data-flow-part="toolbar"`),
    outside the zoom: rendered in
    `Flow.Root` (a portal), at the anchor `node-toolbar-by` gives, so it keeps its size at any zoom.
    Presses and the wheel over it are left to it. It renders only its children (your buttons).
-->
<script lang="ts">
    import { useFlowContext, useNodeId } from "../context.js";
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
        nodeId: nodeIdProp,
        nodeIds: nodeIdsProp,
        side = "top",
        align,
        offset,
        open,
        children,
        render,
        class: className,
        style,
        ref = $bindable(),
        ...rest
    }: NodeToolbarProps = $props();

    // read only for one node: several need no enclosing node
    const nodeIdOf = useNodeId("NodeToolbar", () => nodeIdProp);
    const context = useFlowContext("NodeToolbar");
    // several nodes (`nodeIds` not empty), or one: the given one or the enclosing node's
    const many = $derived(nodeIdsProp !== undefined && nodeIdsProp.length > 0);
    const view = flowValue(context, () => {
        const { engine, model } = context;
        if (!engine) return undefined;
        const nodeId = many ? undefined : nodeIdOf();
        const nodeIds = nodeId === undefined ? [...plain(nodeIdsProp ?? [])] : [nodeId];
        const position = engine.get("node-toolbar-by", {
            ...(nodeId === undefined ? { nodeIds } : { nodeId }),
            side,
            align,
            offset,
        });
        return position
            ? {
                  position,
                  nodeId,
                  nodeIds,
                  attributes: engine.adapter.attributes(
                      "toolbar",
                      nodeId === undefined ? {} : { nodeId },
                  ),
                  selected: nodeIds.every((id) =>
                      model.is("node-selected", { nodeId: id }),
                  ),
              }
            : undefined;
    });
    const refs = refProps((element) => {
        ref = element as HTMLDivElement | null;
    });
    const shown = $derived(open ?? view.current?.selected ?? false);
    const partState = $derived.by((): NodeToolbarState | undefined =>
        view.current
            ? {
                  nodeId: view.current.nodeId,
                  nodeIds: view.current.nodeIds,
                  position: view.current.position,
                  side,
              }
            : undefined,
    );
    const attrs: RenderedProps<HTMLDivElement> = $derived.by(() => {
        if (!partState || !view.current) return {} as RenderedProps<HTMLDivElement>;
        const { x, y, anchorX, anchorY } = partState.position;
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

{#if partState && shown}
    <Portal target={context.rootElement}>{@render toolbar()}</Portal>
{/if}
