<script module lang="ts">
    import type { AnyTypes, FlowNode, FlowTypes } from "@fragiola/flow";
    import type { Snippet } from "svelte";
    import type { NodeState } from "../runes/use-node.svelte.js";
    import type { DivPrimitiveProps } from "../utils/render.js";

    export interface NodeProps<T extends FlowTypes = AnyTypes>
        extends Omit<DivPrimitiveProps<NodeState<T>>, "children"> {
        /** the node it renders: the one `Flow.Nodes` gives its children snippet */
        node: FlowNode<T>;
        /** the node's content: `Flow.Handle`s, a resizer, a toolbar */
        children?: Snippet<[{ state: NodeState<T> }]> | undefined;
    }
</script>

<!--
    @component
    One node (`data-flow-part="node"`, `data-flow-id`), absolutely positioned at its place in the
    viewport (a structural `transform`), registered with the engine, which measures it and resolves
    presses on it (drag, select, connect from its handles). It renders only its children: the
    content, `Flow.Handle`s, a resizer, a toolbar.
-->
<script lang="ts" generics="T extends FlowTypes = AnyTypes">
    import { setNodeContext } from "../context.js";
    import { useNode } from "../runes/use-node.svelte.js";
    import {
        elementProps,
        refProps,
        styleRecord,
        type RenderedProps,
    } from "../utils/render.js";

    let {
        node,
        children,
        render,
        class: className,
        style,
        ref = $bindable(),
        ...rest
    }: NodeProps<T> = $props();

    const own = useNode<T>(() => node);
    // the id alone: the parts inside follow another id, not every new node object
    const nodeId = $derived(node.id);
    setNodeContext({
        get nodeId() {
            return nodeId;
        },
    });
    const refs = refProps((element) => {
        ref = element as HTMLDivElement | null;
    });
    const attrs: RenderedProps<HTMLDivElement> = $derived.by(() => {
        const { style: structural, ...attributes } = own.props;
        return elementProps({
            rest,
            className,
            style,
            state: own.state,
            own: { ...attributes, ...refs },
            structural: styleRecord(structural),
        });
    });
</script>

{#snippet content()}{@render children?.({ state: own.state })}{/snippet}

{#if render}
    {@render render({ props: attrs as never, state: own.state, children: content })}
{:else}
    <div {...attrs}>{@render content()}</div>
{/if}
